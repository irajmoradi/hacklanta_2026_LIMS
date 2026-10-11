set -e
mkdir -p ~/village-cv/repos && cd ~/village-cv/repos
[ -d LAM ] || git clone --depth 1 https://github.com/aigc3d/LAM.git
[ -d LAM_Audio2Expression ] || git clone --depth 1 https://github.com/aigc3d/LAM_Audio2Expression.git
ls LAM LAM_Audio2Expression
