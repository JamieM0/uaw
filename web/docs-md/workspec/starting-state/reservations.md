---
title: "Reservations"
description: "Reference exclusive and capacity reservations, selection, conflicts, and resolved attempts."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 410
---

# Reservations

A reservation claims an object or location while a task is active.

## Exclusive reservation

An exclusive reservation blocks every concurrent claim on the same target.

```json
{
  "resource": "autoclave_1",
  "mode": "exclusive"
}
```

Do not add `amount` to an exclusive reservation.

## Capacity reservation

A capacity reservation consumes part of `properties.capacity` on the target.

```json
{
  "resource": "wash_station",
  "mode": "capacity",
  "amount": 2
}
```

Include `amount` and make it resolve to a positive finite number. Give the target a finite, non-negative capacity.

## Expression fields

`resource` is a value expression that must resolve to an object or location ID. `amount` is also a value expression.

## Runtime behavior

The runtime evaluates reservations after guards and performer selection. It checks same-time peers and existing active reservations.

A conflicting claim blocks affected task starts and produces a runtime Problem. Even a failed claim counts as an attempted use of its target.

A resolved snapshot contains active reservation records. Authored reservations describe claims, not guaranteed allocations.
