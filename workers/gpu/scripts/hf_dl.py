"""usage: python hf_dl.py <repo_id> <local_dir>   (uses HF_TOKEN from env)"""
import os, sys
from huggingface_hub import snapshot_download
print(snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2], token=os.environ.get("HF_TOKEN")))
