#!/usr/bin/env bash
# CV-007 face match: OpenCV (CPU) YuNet detector (MIT) + SFace recognizer (Apache-2.0) into the gateway env vcv-sam3.
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-sam3
python -c "import cv2" 2>/dev/null || pip install "opencv-python-headless==4.10.0.84"
D=$VCV_ROOT/checkpoints/face; mkdir -p $D; cd $D
Z=https://github.com/opencv/opencv_zoo/raw/main/models
[ -s face_detection_yunet_2023mar.onnx ] || wget -q -O face_detection_yunet_2023mar.onnx $Z/face_detection_yunet/face_detection_yunet_2023mar.onnx
[ -s face_recognition_sface_2021dec.onnx ] || wget -q -O face_recognition_sface_2021dec.onnx $Z/face_recognition_sface/face_recognition_sface_2021dec.onnx
ls -la; sha256sum *.onnx
python -c "import cv2; print(cv2.__version__, hasattr(cv2,'FaceRecognizerSF'), hasattr(cv2,'FaceDetectorYN'))"
