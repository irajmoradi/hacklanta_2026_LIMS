"""Issue a 72-hour single-use code; stdout is the only copy. Run from apps/api."""
import argparse
import secrets
from uuid import UUID

import psycopg

from app.claims import code_hash
from app.config import Settings


def issue(conn, village: UUID, seat: UUID) -> str:
    row = conn.execute('SELECT auth_issuer FROM users WHERE id=%s FOR UPDATE', (seat,)).fetchone()
    if not row or row[0] != 'demo' or not conn.execute(
        'SELECT 1 FROM village_members WHERE village_id=%s AND user_id=%s', (village, seat)
    ).fetchone():
        raise ValueError('Choose an existing demo seat in this village')
    if conn.execute('SELECT 1 FROM auth_seat_links WHERE seat_id=%s', (seat,)).fetchone():
        raise ValueError('This seat is already linked')
    code = f'{village}.{secrets.token_urlsafe(32)}'
    conn.execute('UPDATE seat_claim_codes SET consumed_at=now() WHERE seat_id=%s', (seat,))
    conn.execute('INSERT INTO seat_claim_codes(code_hash,village_id,seat_id) VALUES (%s,%s,%s)',
                 (code_hash(code), village, seat))
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--village', type=UUID, required=True)
    parser.add_argument('--seat', type=UUID, required=True)
    args = parser.parse_args()
    try:
        with psycopg.connect(Settings.from_env().database_url, connect_timeout=5) as conn:
            code = issue(conn, args.village, args.seat)
    except Exception as exc:
        parser.exit(1, f'Claim code not issued ({type(exc).__name__}); check seat and database.\n')
    print(code)


if __name__ == '__main__':
    main()
