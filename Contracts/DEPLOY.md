# Deploying contracts from the terminal (Thirdweb)

Your Solidity contracts live in the **`contracts`** folder (i.e. `Contracts/contracts/*.sol`). Thirdweb uses Hardhat here, so that path is set in `hardhat.config.js`.

## One-time setup

1. **Install dependencies** (from the `Contracts` folder):

   ```bash
   cd Contracts
   npm install
   ```

2. **Use your secret key with the CLI** (optional). Either:

   - Add to your `Contracts/.env`:
     ```env
     THIRDWEB_SECRET_KEY=your_secret_key_here
     ```
     (Same value as your existing `secret_key` is fine.)

   - Or pass it every time with `-k <secret-key>` (see below).

## Commands (run from `Contracts` folder)

| What | Command |
|------|--------|
| **Build** (compile + detect extensions) | `npx thirdweb build` |
| **Deploy** (opens browser to choose chain & sign) | `npx thirdweb deploy` |
| **Deploy with secret key** | `npx thirdweb deploy -k <your-secret-key>` |
| **Deploy using .env** | `npx thirdweb deploy -k %THIRDWEB_SECRET_KEY%` (Cmd) or `npx thirdweb deploy -k $env:THIRDWEB_SECRET_KEY` (PowerShell) |

If `THIRDWEB_SECRET_KEY` is in `.env`, you can load it and deploy in one go (PowerShell):

```powershell
cd Contracts
# Load .env then deploy (no key in command)
Get-Content .env | ForEach-Object { if ($_ -match '^THIRDWEB_SECRET_KEY=(.+)$') { $env:THIRDWEB_SECRET_KEY = $matches[1] } }
npx thirdweb deploy -k $env:THIRDWEB_SECRET_KEY
```

Or with **Git Bash** (recommended on Windows per Thirdweb docs):

```bash
cd Contracts
export $(grep -v '^#' .env | xargs)
npx thirdweb deploy -k $THIRDWEB_SECRET_KEY
```

## Flow

1. `npx thirdweb build` — compiles contracts and detects Thirdweb extensions.
2. `npx thirdweb deploy` — uploads build, opens a link in the browser to pick network, constructor args, and sign with your wallet (no private key in the terminal).

**Note:** On Windows, Thirdweb recommends **Git Bash** or **Command Prompt** instead of PowerShell due to known issues.
