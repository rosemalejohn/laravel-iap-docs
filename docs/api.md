# API Reference

This article explains in depth the backend implementation of how Payment works with Subscription and Consumables.

## Plans

This holds all the plans for the app, whether it is consumable or subscription type. Here is the mysql table reference:

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

List of all features on each plan.

### Table Reference

| Field                 | Description
| ----------------------|:-------------:|
| id                    | Primary Key ID |
| slug                  | Type of feature or feature slug. Example call, like, rewind in the case of Concha |
| name                  | Name of the feature |
| description           | Brief description of feature |
| value                 | Default value of the value, can be numeric or string or boolean |
| resettable_period     | Options are `yearly`, `monthly` and `daily`. |
| resettable_interval   | How often the feature usage will reset. |
| created_at            | Date plan is created |
| updated_at            | Date when plan is last updated |

## Plan Subscription

List all the plan subscription of users

### Table Reference

| Field                 | Description
| ----------------------|:-------------:|
| id                    | Primary Key ID |
| user_type             | Type of user who needs subscription can be an Admin model, a user model or anything |
| user_id               | Primary ID of the `user_type` |
| plan_id               | Plan ID of the plan the user is subscribed to |
| slug                  | Subscription type, options are `freemium`, `consumables`, `concha-club` |
| name                  | Name of the plan subscription |
| starts_at             | Date of when the user subscription will start or started |
| ends_at               | Date of when the user subscription will end |
| cancels_at            | Date of when the user subscription will be canceled |
| canceled_at           | Date of when the user subscription was canceled |
| created_at            | Date plan is created |
| updated_at            | Date when plan is last updated |

### Methods

Cancel the user subscription

``` php
public function cancel($immediately = false)
{
    $this->canceled_at = now();

    if ($immediately) {
        $this->ends_at = $this->canceled_at;
    }

    $this->save();

    return $this;
}
```

Change or upgrade the user subscription plan

``` php
public function changePlan(Plan $plan)
{
    // If plans does not have the same billing frequency
    // (e.g., invoice_interval and invoice_period) we will update
    // the billing dates starting today, and sice we are basically creating
    // a new billing cycle, the usage data will be cleared.
    if ($this->plan->invoice_interval !== $plan->invoice_interval || $this->plan->invoice_period !== $plan->invoice_period) {
        $this->setNewPeriod($plan->invoice_interval, $plan->invoice_period);
        $this->usage()->delete();
    }

    // Attach new plan to subscription
    $this->plan_id = $plan->getKey();
    $this->save();

    return $this;
}
```

Renew the subscription

``` php
public function renew()
{
    if ($this->ended() && $this->canceled()) {
        throw new LogicException('Unable to renew canceled ended subscription.');
    }

    $subscription = $this;

    DB::transaction(function () use ($subscription) {
        // Clear usage data
        $subscription->usage()->delete();

        // Renew period
        $subscription->setNewPeriod();
        $subscription->canceled_at = null;
        $subscription->save();
    });

    return $this;
}
```

Record feature usage

``` php
public function recordFeatureUsage(
    string $featureSlug,
    int $uses = 1,
    bool $incremental = true
): PlanSubscriptionUsage {
    $feature = $this->plan->features()->where('slug', $featureSlug)->first();

    $usage = $this->usage()->firstOrNew([
        'subscription_id' => $this->getKey(),
        'feature_id' => $feature->getKey(),
    ]);

    $incremental = is_numeric($feature->value);

    if ($feature->resettable_period) {
        // Set expiration date when the usage record is new or doesn't have one.
        if (is_null($usage->valid_until)) {
            // Set date from subscription creation date so the reset
            // period match the period specified by the subscription's plan.
            $usage->valid_until = $feature->getResetDate($this->created_at);
        } elseif ($usage->expired()) {
            // If the usage record has been expired, let's assign
            // a new expiration date and reset the uses to zero.
            $usage->valid_until = $feature->getResetDate($usage->valid_until);
            $usage->used = 0;
        }
    }

    $usage->used = ($incremental ? $usage->used + $uses : $uses);

    $usage->save();

    // check how many feature for this plan
    $featureCount = $this->plan->features()->count();

    // if feature value is equal to used then we mark the plan subscription to end
    if ($featureCount === 1 && $incremental && $usage->used === (int) $feature->value) {
        $this->ends_at = now();
        $this->save();
    }

    return $usage;
}
```

Reduce feature usage

``` php
public function reduceFeatureUsage(string $featureSlug, int $uses = 1): ?PlanSubscriptionUsage
{
    $usage = $this->usage()->byFeatureSlug($featureSlug, $this->plan_id)->first();

    if (is_null($usage)) {
        return null;
    }

    $usage->used = max($usage->used - $uses, 0);

    $usage->save();

    return $usage;
}
```

Determine if the user can use feature

``` php
public function canUseFeature(string $featureSlug): bool
{
    $featureValue = $this->getFeatureValue($featureSlug);

    // return false if feature is not part of plan
    if (is_null($featureValue)) {
        return false;
    }

    $usage = $this->usage()->byFeatureSlug($featureSlug, $this->plan_id)->first();

    if ($featureValue === 'true' || $featureValue === 'Y') {
        return true;
    }

    if (is_null($usage)) {
        return true;
    }

    // If the feature value is zero, let's return false since
    // there's no uses available. (useful to disable countable features)
    if ($usage->expired() || is_null($featureValue) || $featureValue === '0' || $featureValue === 'false') {
        return false;
    }

    // Check for available uses
    return $this->getFeatureRemainings($featureSlug) > 0;
}
```

Get feature usage

``` php
public function getFeatureUsage(string $featureSlug): int
{
    $used = 0;
    $usage = $this->usage()->byFeatureSlug($featureSlug, $this->plan_id)->first();
    if ($usage) {
        $used = !$usage->expired() ? $usage->used : 0;
    }
    
    return $used;
}
```

Get feature remaining value

``` php
public function getFeatureRemainings(string $featureSlug): int
{
    $credits = 0;

    if ($this->getFeatureValue($featureSlug)) {
        if ($this->getFeatureValue($featureSlug) === 'Y') {
            $credits = -1;
        } else {
            $credits = ($this->getFeatureValue($featureSlug) - $this->getFeatureUsage($featureSlug));
        }
    }
    return $credits;
}
```

Get feature value

``` php
public function getFeatureValue(string $featureSlug)
{
    $feature = $this->plan->features()->where('slug', $featureSlug)->first();
    return $feature ? $feature->value : null;
}
```

## Plan Subscription Usage

List of all the user subscription feature usages

### Table Reference

| Field                 | Description
| ----------------------|:-------------:|
| id                    | Primary Key ID |
| subscription_id       | Plan subscription ID on `plan_subscriptions` table |
| feature_id            | Feature ID on `plan_features` table |
| used                  | Value of how many was used |
| valid_until           | Date of when the usage value is valid |
| created_at            | Date plan is created |
| updated_at            | Date when plan is last updated |

## Invoice / Transaction

List all the payment transactions and record payment provider details (Google Play and App Store Payment)

### Table Reference

| Field                 | Description
| ----------------------|:-------------:|
| id                    | Primary Key ID |
| plan_subscription_id  | Plan subscription ID on `plan_subscriptions` table |
| user_id               | User ID on `users` table |
| transaction_id        | Transaction ID from Google and Apple Payment |
| platform              | Payment platform who made the transaction, options are `android` and `ios` |
| plan                  | Plan Slug or registered plan ID from Google Play and Apple payment |
| currency              | Currency used to purchase the transaction |
| amount_cents          | Transaction amount in cents |
| purchase_token        | Google Play purchase token |
| receipt_data          | iTunes receipt data |
| created_at            | Date plan is created |
| updated_at            | Date when plan is last updated |

### Methods

Find by transaction ID and query on `transaction_id` or `purchase_token` column

``` php
public static function findByTransaction($transactionId): ?Invoice
{
    return self::whereTransactionId($transactionId)->orWhere('purchase_token', $transactionId)->first();
}
```