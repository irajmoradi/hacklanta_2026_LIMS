"""ASSET-006 stable style ordering and sRGB runtime tint presets."""
STYLES = ('cottage', 'modern', 'aframe', 'tudor', 'beach', 'townhouse')
TINTS = ('wall', 'roof', 'trim', 'door', 'accent')
COLORS = {
    'cottage': [('F1D9AD','B69B55','715038','487D6B','CA795D'), ('D9DDD0','737955','EEE3C8','AA6351','718C73'), ('E7BCA3','886448','F5DEB5','536F87','AD7354')],
    'modern': [('E4E4DC','424D58','394653','DC9D50','4E8E91'), ('B6C6C9','344652','E9E2D5','AD6454','D7A95F'), ('D5C3B1','61574D','EEEAE1','4A7C71','BA785F')],
    'aframe': [('B78456','485E68','E2C795','9C4F3C','D0A251'), ('C4A586','344C42','F1D8A4','976950','6F9D8A'), ('99634C','574C68','E8C9A0','729C9F','CFA268')],
    'tudor': [('EEDBBC','69566B','4F3C35','A65B49','7B9870'), ('D9DFCF','526B69','5C4839','9B6849','C29056'), ('D5BFAE','8D5148','453B39','677EAA','B49362')],
    'beach': [('9DC9CC','D2AB74','F3E8CD','DB8469','497B92'), ('ECCBA3','899B82','F7EDD8','568C8B','C97962'), ('C4B3D6','778D9E','F4E4D3','CF936E','669995')],
    'townhouse': [('B86C52','4F515B','E0C49A','3F6D72','799A72'), ('C49A75','5C6767','F1DCC0','865A64','61919C'), ('987367','38495B','D6D7C8','B99156','829B70')],
}
PALETTES = {s: [dict(zip(TINTS, ('#'+v for v in row))) for row in rows] for s, rows in COLORS.items()}
LEGACY = {f'house_lv{lv}{suffix}': (STYLES[(lv-1+(3 if suffix else 0))%6], min(lv,3), 1 if suffix else 0)
          for lv in range(1,6) for suffix in ('','_b')}
MODELS = {**LEGACY, **{f'house_{s}_lv{lv}': (s,lv,0) for s in STYLES for lv in range(1,4)}}
