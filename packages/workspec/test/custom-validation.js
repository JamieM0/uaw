function validateMinimumTaskCount(metric) {
    const tasks = this.simulation?.process?.tasks || [];
    const minCount = metric?.params?.min_count ?? 1;

    if (tasks.length < minCount) {
        this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Expected at least ${minCount} task(s), found ${tasks.length}.`
        });
        return;
    }

    this.addResult({
        metricId: metric.id,
        status: 'success',
        message: `Task count check passed (${tasks.length} task(s)).`
    });
}
