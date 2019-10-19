# API Reference

This article explains in depth the backend implementation of how Payment works with Subscription and Consumables.

## Plans

These holds all the plans for the app, whether it is consumable or subscription type. Here is the mysql table reference:

### Table Reference

| Field             | Description
| ----------------- |:-------------:|
| id                | Primary Key ID |
| type              | We provided options for type `consumables`, `concha-club` and `freemium` |
| slug              | This is the plan slug that was saved when we initially created plans on our Google Play Console and Apple app Store. We need to make sure plan ID is same on both platforms.      |
| name              | The name of the plan |
| description       | Basic description of the plan |
| is_active         | Determines whether the plan is active or not |
| price             | Price of the plan |
| currency          | Currency used for the plan |
| invoice_period    | Options are `yearly`, `monthly` and `daily`. |
| invoice_interval  | How often the billing cycle will recur, if consumable then we just need to put `null` or `0` |
| created_at        | Date plan is created |
| updated_at        | Date when plan is last updated |

### Methods

Get the plan feature by slug

``` php
public function getFeatureBySlug(string $featureSlug): ?PlanFeature
{
    return $this->features()->where('slug', $featureSlug)->first();
}
```

Make the plan active

``` php
public function activate()
{
    $this->update(['is_active' => true]);

    return $this;
}
```

Deactivate the plan

``` php
public function deactivate()
{
    $this->update(['is_active' => false]);

    return $this;
}
```

Find Plan by slug ID

``` php
public static function findBySlug($slug): ?Plan
{
    return self::whereSlug($slug)->first();
}
```

## Plan Feature

## Plan Subscription

## Plan Subscription Usage

## Invoice