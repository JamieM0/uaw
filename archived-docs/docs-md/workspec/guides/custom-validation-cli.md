# WorkSpec CLI: Custom Validation (Simple Guide)

Use this when you want to run your own checks on a WorkSpec file.

You always need:

1. A JavaScript file with your check function(s).

You may also use:

2. A small JSON catalog.

The catalog is optional. Use it only when you want to run specific functions.

## 1) Create `custom-validation.js`

```js
function validateMinimumTaskCount(metric) {
    const tasks = this.simulation?.process?.tasks || [];
    const minCount = metric?.params?.min_count ?? 1;

    if (tasks.length < minCount) {
        this.addResult({
            metricId: metric.id,
            status: "error",
            message: `Expected at least ${minCount} task(s), found ${tasks.length}.`
        });
        return;
    }

    this.addResult({
        metricId: metric.id,
        status: "success",
        message: "Task count is OK."
    });
}
```

## 2) Run with auto-discovery (no catalog)

If you do not pass a catalog, WorkSpec auto-discovers functions in your JavaScript file that start with `validate`.

```bash
workspec validate \
  --custom ./custom-validation.js \
  ./my-file.workspec.json \
  -y
```

## 3) Optional: create `metrics-catalog-custom.json`

Use a catalog only when you want to run selected functions (instead of every discovered `validate...` function).

```json
[
  {
    "id": "custom.minimum_task_count",
    "name": "Minimum Task Count",
    "source": "custom",
    "validation_type": "computational",
    "function": "validateMinimumTaskCount",
    "params": {
      "min_count": 1
    }
  }
]
```

## 4) Run validation with a catalog

```bash
workspec validate \
  --custom ./custom-validation.js \
  --custom-catalog ./metrics-catalog-custom.json \
  ./my-file.workspec.json \
  -y
```

## What this does

- Runs normal WorkSpec validation first.
- Runs your custom check(s) after that.
- Returns exit code `0` if there are no errors.
- Returns exit code `1` if there is at least one error.

## Notes

- Auto-discovery finds functions that start with `validate`.
- The catalog is optional.
- Use a catalog when you want to run only specific functions.
- The catalog tells WorkSpec which function(s) to call.
- The JavaScript file contains the real check logic.
- Custom validators can be dangerous/malicious. The CLI prompts for `Y` confirmation before running them unless you pass `-y`/`--yes`.
- Custom validation runs in an isolated subprocess with a hard timeout, and catalog/auto-discovered function names must follow `validate*`.
- If you do not pass `--custom-catalog`, WorkSpec will try to load `metrics-catalog-custom.json` from the same folder as your `--custom` JavaScript file.
