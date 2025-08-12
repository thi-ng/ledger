# @thi.ng/ledger-cli

Command-line-driven accounting toolchain.

```text
npx @thi.ng/ledger-cli --help

 █ █   █           │
██ █               │
 █ █ █ █   █ █ █ █ │ @thi.ng/ledger-cli v1.0.0
 █ █ █ █ █ █ █ █ █ │ Multi-command CLI for thi.ng/ledger toolchain
                 █ │
               █ █ │

Usage: ledger-cli <cmd> [opts] input [...]
       ledger-cli <cmd> --help

Available commands:

classify : Classify transactions using provided rules & filters
import   : Import transactions from CSV using provided import rules & transforms
report   : Produce balance reports (optionally filtered) in different formats
```

## import

Import transactions from CSV using provided import rules & transforms:

```text
ledger-cli import --help

Flags:

--dry-run                     Dry run (no changes applied)
-q, --quiet                   Disable logging
-v, --verbose                 Display extra information

Main:

--db STR                      Ledger DB path (default: $THING_LEDGER_FILE)
-r STR, --rules STR           [required] Import rules (CSV column transforms)
```

## classify

Classify transactions using provided rules & filters:

```text
ledger-cli classify --help

Flags:

--dry-run                     Dry run (no changes applied)
-q, --quiet                   Disable logging
-v, --verbose                 Display extra information

Main:

--db STR                      Ledger DB path (default: $THING_LEDGER_FILE)
-j STR, --journal STR         Ledger journal path (default: $THING_JOURNAL_FILE)
-r STR, --rules STR           [required, multiple] Classifier rules
```

## report

Produce balance reports (optionally filtered) in different formats:

```text
ledger-cli report --help

Flags:

-a, --aggregate               Compute aggregates of nested balances
-q, --quiet                   Disable logging
-v, --verbose                 Display extra information

Main:

-d STR, --delim STR           Delimiter char for nested balance IDs (default: ":")
-f ID, --fmt ID               Output format: "csv", "json", "md" (default: "md")
-j STR, --journal STR         Ledger journal path (default: $THING_JOURNAL_FILE)
-o STR, --out-file STR        Output file (uses stdout if omitted)

Filters:

--from DATE                   Start date (yyyy-MM-dd format)
-i NAME, --include NAME       [multiple] Only include given balance ID
--to DATE                     End date (yyyy-MM-dd format)
```

## License

&copy; 2025 Karsten Schmidt // Apache Software License 2.0
