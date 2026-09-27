"""Export print-ready meshes and previews with OpenSCAD."""
from pathlib import Path
import argparse
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--openscad", default="openscad")
args = parser.parse_args()
root = Path(__file__).resolve().parent

for part in ("base", "cover"):
    subprocess.run([args.openscad, "-D", f'part="{part}"', "-o", str(root / f"{part}.stl"),
                    str(root / "jukebox.scad")], check=True)

for part, name in [("assembly", "preview"), ("exploded", "assembly"),
                   ("plate", "print-layout"), ("inside", "inside")]:
    subprocess.run([args.openscad, "-D", f'part="{part}"', "--imgsize=1400,1000",
                    "--viewall", "--autocenter", "--projection=o", "--colorscheme=Tomorrow",
                    "--camera=0,0,0,55,0,335,250", "-o", str(root / f"{name}.png"),
                    str(root / "jukebox.scad")], check=True)
