"""ASSET-005 inventory and civic/festival visual requirements."""
ADDITIONS = {
    'mayor_podium': ({'civic_white', 'civic_green', 'brass', 'stone'},
        'Central plaza: round domed civic gazebo, lectern, scroll, gavel, flag and bell; front steps face +Z'),
    'mayor_statue': ({'brass', 'civic_green', 'stone'},
        'Central plaza: friendly round-bellied AI Mayor with top hat and scroll on a stone plinth; faces +Z'),
    'notice_board': ({'civic_green', 'brass', 'paper'},
        'Central plaza: roofed Village Gazette bulletin board; posted notices face +Z'),
    'festival_main_stage': ({'metal', 'neon_cyan', 'neon_pink'},
        'Festival district: large truss arch, LED-style equalizer screen, speakers and crowd barriers; faces +Z'),
}
NAMES = tuple(ADDITIONS)
REQUIRED_NODES = {
    'mayor_podium': {'dome', 'lectern', 'scroll', 'gavel', 'flagpole', 'bell'},
    'mayor_statue': {'top_hat', 'round_belly', 'scroll', 'plinth'},
    'notice_board': {'gazette_header', 'notice_0', 'notice_1', 'notice_2'},
    'festival_main_stage': {'led_screen', 'arch_top', 'speaker_left', 'speaker_right', 'barrier_left', 'barrier_right'},
}
