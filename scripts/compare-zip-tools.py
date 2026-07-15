import zipfile, subprocess, shutil, pathlib

root = pathlib.Path(__file__).resolve().parents[1]
staging = root / "_perm-test-staging"
if staging.exists():
    shutil.rmtree(staging)
(staging / "src/app/api/ai/stats").mkdir(parents=True)
(staging / "src/app/api/ai/stats/route.ts").write_text("export {}")
(staging / "src/app/api/ai/_shared.ts").write_text("// shared")

tar_zip = root / "_perm-test-tar.zip"
ps_zip = root / "_perm-test-ps.zip"
subprocess.run(["tar", "-acf", str(tar_zip), "-C", str(staging), "."], check=True)
subprocess.run(
    [
        "powershell",
        "-NoProfile",
        "-Command",
        f"Compress-Archive -Path '{staging}/*' -DestinationPath '{ps_zip}' -Force",
    ],
    check=True,
)

for name in [tar_zip, ps_zip]:
    with zipfile.ZipFile(name) as z:
        ai = [i for i in z.infolist() if "api/ai" in i.filename]
        print(f"=== {name.name} ===")
        for i in ai:
            mode = (i.external_attr >> 16) & 0o7777
            print(i.filename, "mode", oct(mode), "sys", i.create_system)

shutil.rmtree(staging)
for p in [tar_zip, ps_zip]:
    p.unlink(missing_ok=True)
