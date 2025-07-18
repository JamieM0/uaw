---
name: New Metric/Constraint Suggestion
about: Suggest a new metric or constraint for simulations to be validated on.
title: "[Metric/Constraint Suggestion]"
labels: Metric/Constraint Suggestion
assignees: ''

---

### Metric Name
Business is profitable

### Description (What should it check?)
Checks to make sure that the business is profitable

### Category
Realism

### Proposed Severity
Warning

### Validation Type (computational or llm)
computational

### Example conditions for failing this check
totalCosts >= totalRevenue

### Rough example for a simulation that would PASS this check.
totalCosts < totalRevenue

# Other Notes / Information
Not to be confused with this check: is business losing money (these are **NOT** direct opposites, we must consider the possibility for a business to break even)
