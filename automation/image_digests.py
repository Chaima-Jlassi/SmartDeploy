import argparse
import re
import subprocess
from pathlib import Path


try:
    ROOT = Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=Path.cwd(),
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    )
except (OSError, subprocess.CalledProcessError):
    ROOT = Path(__file__).resolve().parents[1]
SERVICES = {"product-catalog", "order-service", "notification-service"}
ENVIRONMENTS = {"dev", "staging", "prod"}
DIGEST_LINE = re.compile(r'^(\s*digest:\s*)(?:"[^"]*"|[^\s#]*)(.*)$', re.MULTILINE)
DIGEST_VALUE = re.compile(r"^sha256:[0-9a-f]{64}$")


def values_path(service, environment):
    if service not in SERVICES or environment not in ENVIRONMENTS:
        raise ValueError("Unsupported service or environment.")
    return ROOT / "helm" / f"values-{service}-{environment}.yaml"


def replace_digest(content, digest):
    if not DIGEST_VALUE.fullmatch(digest):
        raise ValueError("Image digest must be a sha256 digest.")
    updated, count = DIGEST_LINE.subn(lambda match: f'{match.group(1)}"{digest}"{match.group(2)}', content)
    if count != 1:
        raise ValueError("Expected exactly one image digest field.")
    return updated


def set_digest(path, digest):
    resolved = path.resolve()
    if resolved.parent != (ROOT / "helm").resolve():
        raise ValueError("Values file must be directly inside the Helm chart directory.")
    content = resolved.read_text(encoding="utf-8")
    resolved.write_text(replace_digest(content, digest), encoding="utf-8")


def get_digest(content):
    match = DIGEST_LINE.search(content)
    if not match:
        raise ValueError("Image digest field was not found.")
    value = match.group(0).split(":", 1)[1].strip().strip('"')
    return value if DIGEST_VALUE.fullmatch(value) else None


def rollback(service, environment):
    path = values_path(service, environment)
    relative_path = path.relative_to(ROOT).as_posix()
    current = get_digest(path.read_text(encoding="utf-8"))
    if not current:
        raise ValueError("Current image digest is not set.")

    commits = subprocess.run(
        ["git", "log", "--format=%H%x09%s", "--", relative_path],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()

    for entry in commits:
        commit, subject = entry.split("\t", 1)
        previous_file = subprocess.run(
            ["git", "show", f"{commit}^:{relative_path}"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if previous_file.returncode:
            continue
        previous = get_digest(previous_file.stdout)
        commit_file = subprocess.run(
            ["git", "show", f"{commit}:{relative_path}"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        committed_digest = get_digest(commit_file)
        if committed_digest == previous:
            continue
        normalized_subject = subject.lower()
        if normalized_subject.startswith("rollback:") or f"rollback/{service}-{environment}" in normalized_subject:
            print(f"{service} in {environment} was already rolled back.")
            return
        if committed_digest != current:
            raise ValueError("Current deployment digest does not match the latest GitOps release.")
        if previous:
            set_digest(path, previous)
            print(f"Restored {service} in {environment} to an earlier image digest.")
            return
        break

    raise ValueError(f"No earlier image digest is available for {service} in {environment}.")


def read_from_git(service, environment, git_ref):
    if git_ref != "origin/dev":
        raise ValueError("Image promotion may only read the dev environment.")
    path = values_path(service, environment)
    relative_path = path.relative_to(ROOT).as_posix()
    content = subprocess.run(
        ["git", "show", f"{git_ref}:{relative_path}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    digest = get_digest(content)
    if not digest:
        raise ValueError(f"No deployed image digest is set for {service} in {environment}.")
    print(digest)


def main():
    parser = argparse.ArgumentParser(description="Update or roll back an immutable Helm image digest.")
    commands = parser.add_subparsers(dest="command", required=True)

    set_command = commands.add_parser("set")
    set_command.add_argument("--values-file", type=Path, required=True)
    set_command.add_argument("--digest", required=True)

    rollback_command = commands.add_parser("rollback")
    rollback_command.add_argument("--service", required=True)
    rollback_command.add_argument("--environment", required=True)

    read_command = commands.add_parser("read")
    read_command.add_argument("--service", required=True)
    read_command.add_argument("--environment", required=True)
    read_command.add_argument("--git-ref", required=True)

    args = parser.parse_args()
    if args.command == "set":
        set_digest(args.values_file, args.digest)
    elif args.command == "rollback":
        rollback(args.service, args.environment)
    else:
        read_from_git(args.service, args.environment, args.git_ref)


if __name__ == "__main__":
    main()
