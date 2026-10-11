use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu");

pub const MAX_PARTICIPANTS: usize = 8;
pub const REFUND_DELAY: i64 = 72 * 60 * 60;

#[program]
pub mod village_pot {
    use super::*;

    pub fn create_pot(
        ctx: Context<CreatePot>,
        week_id: u64,
        entry_lamports: u64,
        auditor: Pubkey,
        auditor_fee_bps: u16,
        deadline: i64,
        payout_mode: u8,
        ranked_bps: Vec<u16>,
    ) -> Result<()> {
        validate_split(payout_mode, &ranked_bps)?;
        require!(auditor_fee_bps <= 2000, PotError::FeeTooHigh);
        require!(entry_lamports > 0, PotError::InvalidEntry);
        entry_lamports
            .checked_mul(MAX_PARTICIPANTS as u64)
            .ok_or(PotError::Overflow)?;
        require!(
            deadline > Clock::get()?.unix_timestamp,
            PotError::InvalidDeadline
        );
        deadline
            .checked_add(REFUND_DELAY)
            .ok_or(PotError::Overflow)?;
        require!(
            auditor != Pubkey::default()
                && auditor != ctx.accounts.pot.key()
                && auditor != ctx.accounts.vault.key(),
            PotError::InvalidAuditor
        );
        ctx.accounts.pot.set_inner(Pot {
            creator: ctx.accounts.creator.key(),
            week_id,
            entry_lamports,
            auditor,
            auditor_fee_bps,
            deadline,
            participants: Vec::new(),
            status: 0,
            bump: ctx.bumps.pot,
            vault_bump: ctx.bumps.vault,
            payout_mode,
            ranked_bps,
        });
        Ok(())
    }

    pub fn join(ctx: Context<Join>) -> Result<()> {
        let pot = &mut ctx.accounts.pot;
        require!(pot.status == 0, PotError::AlreadyFinalized);
        require!(
            Clock::get()?.unix_timestamp < pot.deadline,
            PotError::JoiningClosed
        );
        let participant = ctx.accounts.participant.key();
        require!(participant != pot.auditor, PotError::AuditorCannotJoin);
        require!(
            !pot.participants.contains(&participant),
            PotError::DuplicateParticipant
        );
        require!(pot.participants.len() < MAX_PARTICIPANTS, PotError::PotFull);
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.participant.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            pot.entry_lamports,
        )?;
        pot.participants.push(participant);
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, scores: Vec<u64>) -> Result<()> {
        let pot = &ctx.accounts.pot;
        require!(pot.status == 0, PotError::AlreadyFinalized);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= pot.deadline, PotError::TooEarly);
        require!(now < pot.refund_time()?, PotError::SettlementExpired);
        require!(
            scores.len() == pot.participants.len(),
            PotError::InvalidWinners
        );
        validate_recipients(ctx.remaining_accounts, &pot.participants)?;
        let total = pot.total()?;
        let fee = ((total as u128) * pot.auditor_fee_bps as u128 / 10_000) as u64;
        let payouts = allocate(total - fee, &scores, pot.payout_mode, &pot.ranked_bps)?;
        let vault = ctx.accounts.vault.to_account_info();
        ensure_funded(&vault, total)?;
        pay(&vault, &ctx.accounts.auditor.to_account_info(), fee)?;
        for (recipient, amount) in ctx.remaining_accounts.iter().zip(payouts) {
            pay(&vault, recipient, amount)?;
        }
        ctx.accounts.pot.status = 1;
        Ok(())
    }

    pub fn refund_all(ctx: Context<RefundAll>) -> Result<()> {
        let pot = &ctx.accounts.pot;
        require!(pot.status == 0, PotError::AlreadyFinalized);
        require!(
            Clock::get()?.unix_timestamp >= pot.refund_time()?,
            PotError::TooEarly
        );
        validate_recipients(ctx.remaining_accounts, &pot.participants)?;
        let vault = ctx.accounts.vault.to_account_info();
        ensure_funded(&vault, pot.total()?)?;
        for recipient in ctx.remaining_accounts {
            pay(&vault, recipient, pot.entry_lamports)?;
        }
        ctx.accounts.pot.status = 2;
        Ok(())
    }
}

// Terms are stored at creation; there is deliberately no update instruction.
fn validate_split(mode: u8, split: &[u16]) -> Result<()> {
    require!(mode <= 2, PotError::InvalidSplit);
    require!(
        if mode == 2 {
            !split.is_empty()
                && split.len() <= 10
                && split.iter().all(|v| *v > 0)
                && split.iter().map(|v| *v as u32).sum::<u32>() == 10_000
        } else {
            split.is_empty()
        },
        PotError::InvalidSplit
    );
    Ok(())
}

// Scores are auditor attestations in stored join order. Equal scores prefer earlier
// joiners. Unoccupied ranked places are renormalized. Dust goes in join order to
// positive-weight recipients, conserving every lamport without floating point.
fn allocate(total: u64, scores: &[u64], mode: u8, split: &[u16]) -> Result<Vec<u64>> {
    validate_split(mode, split)?;
    let mut order: Vec<usize> = (0..scores.len()).filter(|i| scores[*i] > 0).collect();
    order.sort_by(|a, b| scores[*b].cmp(&scores[*a]).then(a.cmp(b)));
    require!(!order.is_empty(), PotError::InvalidWinners);
    let mut weights = vec![0u128; scores.len()];
    match mode {
        0 => weights[order[0]] = 1,
        1 => {
            for i in &order {
                weights[*i] = scores[*i] as u128;
            }
        }
        _ => {
            for (i, weight) in order.iter().zip(split) {
                weights[*i] = *weight as u128;
            }
        }
    }
    let sum: u128 = weights.iter().sum();
    let mut payouts: Vec<u64> = weights
        .iter()
        .map(|w| (total as u128 * w / sum) as u64)
        .collect();
    let mut dust = total - payouts.iter().sum::<u64>();
    for (i, weight) in weights.iter().enumerate() {
        if dust > 0 && *weight > 0 {
            payouts[i] += 1;
            dust -= 1;
        }
    }
    Ok(payouts)
}

fn validate_recipients(accounts: &[AccountInfo], keys: &[Pubkey]) -> Result<()> {
    require!(accounts.len() == keys.len(), PotError::InvalidRecipients);
    for (account, key) in accounts.iter().zip(keys) {
        require!(
            account.key == key && account.is_writable && !account.executable,
            PotError::InvalidRecipients
        );
    }
    Ok(())
}

fn ensure_funded(vault: &AccountInfo, total: u64) -> Result<()> {
    let reserve = Rent::get()?.minimum_balance(vault.data_len());
    require!(
        vault.lamports() >= reserve.checked_add(total).ok_or(PotError::Overflow)?,
        PotError::Underfunded
    );
    Ok(())
}

fn pay(vault: &AccountInfo, recipient: &AccountInfo, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let source = vault
        .lamports()
        .checked_sub(amount)
        .ok_or(PotError::Underfunded)?;
    let destination = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(PotError::Overflow)?;
    **vault.try_borrow_mut_lamports()? = source;
    **recipient.try_borrow_mut_lamports()? = destination;
    Ok(())
}

#[derive(Accounts)]
#[instruction(week_id: u64)]
pub struct CreatePot<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(init, payer = creator, space = 8 + Pot::INIT_SPACE,
        seeds = [b"pot", creator.key().as_ref(), &week_id.to_le_bytes()], bump)]
    pub pot: Account<'info, Pot>,
    #[account(init, payer = creator, space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", pot.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut, seeds = [b"pot", pot.creator.as_ref(), &pot.week_id.to_le_bytes()], bump = pot.bump)]
    pub pot: Account<'info, Pot>,
    #[account(mut, seeds = [b"vault", pot.key().as_ref()], bump = pot.vault_bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub auditor: Signer<'info>,
    #[account(mut, seeds = [b"pot", pot.creator.as_ref(), &pot.week_id.to_le_bytes()],
        bump = pot.bump, has_one = auditor @ PotError::UnauthorizedAuditor)]
    pub pot: Account<'info, Pot>,
    #[account(mut, seeds = [b"vault", pot.key().as_ref()], bump = pot.vault_bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct RefundAll<'info> {
    #[account(mut, seeds = [b"pot", pot.creator.as_ref(), &pot.week_id.to_le_bytes()], bump = pot.bump)]
    pub pot: Account<'info, Pot>,
    #[account(mut, seeds = [b"vault", pot.key().as_ref()], bump = pot.vault_bump)]
    pub vault: Account<'info, Vault>,
}

#[account]
#[derive(InitSpace)]
pub struct Pot {
    pub creator: Pubkey,
    pub week_id: u64,
    pub entry_lamports: u64,
    pub auditor: Pubkey,
    pub auditor_fee_bps: u16,
    pub deadline: i64,
    #[max_len(8)]
    pub participants: Vec<Pubkey>,
    /// 0 = open, 1 = settled, 2 = refunded. Retained to prevent reinitialization.
    pub status: u8,
    pub bump: u8,
    pub vault_bump: u8,
    pub payout_mode: u8,
    #[max_len(10)]
    pub ranked_bps: Vec<u16>,
}

impl Pot {
    fn total(&self) -> Result<u64> {
        self.entry_lamports
            .checked_mul(self.participants.len() as u64)
            .ok_or_else(|| error!(PotError::Overflow))
    }
    fn refund_time(&self) -> Result<i64> {
        self.deadline
            .checked_add(REFUND_DELAY)
            .ok_or_else(|| error!(PotError::Overflow))
    }
}

#[account]
#[derive(InitSpace)]
pub struct Vault {}

#[error_code]
pub enum PotError {
    #[msg("Invalid payout mode or ranked split")]
    InvalidSplit,
    #[msg("Auditor fee exceeds 2000 basis points")]
    FeeTooHigh,
    #[msg("Entry must be positive")]
    InvalidEntry,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Invalid auditor address")]
    InvalidAuditor,
    #[msg("Pot is already finalized")]
    AlreadyFinalized,
    #[msg("Joining closes at the deadline")]
    JoiningClosed,
    #[msg("Auditor must sit out")]
    AuditorCannotJoin,
    #[msg("Participant already joined")]
    DuplicateParticipant,
    #[msg("Pot already has eight participants")]
    PotFull,
    #[msg("Deadline has not been reached")]
    TooEarly,
    #[msg("Refund window has started")]
    SettlementExpired,
    #[msg("Winners must be nonempty, unique participants")]
    InvalidWinners,
    #[msg("Supply exact writable recipients in the required order")]
    InvalidRecipients,
    #[msg("Vault cannot cover entries while retaining rent")]
    Underfunded,
    #[msg("Only the assigned auditor may settle")]
    UnauthorizedAuditor,
}
