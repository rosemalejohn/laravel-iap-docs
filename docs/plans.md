# Plans

There are two types of plan supported, consumable and subscription.

## Consumables

Consumables are the one that can be purchased one time and use it on different features of the app.

## Subscription

Subscriptions are the one that the user can buy and will recur based on the given duration provided.

## Purchasing Plan

Upon initial purchase of each plan, whether it is consumable or subscription we created an API endpoint to handle successful payment made in the app (**android** and **ios**). We then need to map the transaction ID or the purchase token to the user who made the purchase so we can get the information when we receive the webhook on the later time.

| Key               | Description
| ----------------- |:-------------:|
| plan              | This is the plan ID registered from Google Play or iOS app store |
| transaction_id    | This applies to iOS. Upon initial purchase of plan from app store we need to get the `original_transaction_id` and pass it here      |
| platform          | Platform choices are `android` and `ios`      |
| receipt_data      | This applies to iOS. The receipt data the iOS app received upon initial purchase.      |
| purchase_token    | This applies to android. Purchase token received upon initial buy from the app.      |
| package_name      | This applies to android. Package name received upon initial buy      |

Upon receiveing this request payload. Our backend API now validates the `receipt_data` or `purchase_token` to the Apple App Store or Google Play Store.

Here is how we validate if platform is `ios`

``` php
$response = ITunesValidator::setReceiptData($this->receipt_data)
    ->validate();

if ($response->isValid()) {
    $receipt = $response->getReceipt();
    $inApp = Arr::get($receipt, 'in_app');
    $purchase = Arr::first($inApp, function ($purchase) {
        return $purchase['transaction_id'] === $this->transaction_id;
    });
    $productId = Arr::get($purchase, 'product_id');

    if (is_null($productId)) {
        $productId = Arr::get($receipt, 'product_id');
    }

    if ($productId !== $this->plan) {
        $validator->errors()->add('receipt_data', 'Product ID does not match the plan');
    }
} else {
    $validator->errors()->add('receipt_data', 'Invalid receipt data');
}
```

...and when platform is `android`

``` php
try {
    $validator = PlayValidator::setPackageName($this->package_name)
        ->setProductId($this->plan)
        ->setPurchaseToken($this->purchase_token)
        ->validateSubscription();
} catch (Google_Service_Exception $ex) {
    $error = Arr::first($ex->getErrors());
    if (Arr::get($error, 'reason') === 'nonSubscriptionToken') {
        return;
    }
    $validator->errors()->add('purchase_token', 'Invalid purchase token');
}
```

For validating this receipt, we used this [library](https://github.com/aporat/store-receipt-validator/blob/master/README.md) which supports validating iTunes, Play Store and Amazon App Store.

After successfully validating the request payload. We then need to map the `transaction_id` or `purchase_token` to the user who made the purchase.

``` php
// Query the plan that is saved in our database based on the plan passed 
$plan = Plan::whereSlug(Arr::get($data, 'plan'))->first();

DB::beginTransaction();

try {
    // we then need to add a new subscription / consumable to the user
    $subscription = $user->newSubscription($plan->type, $plan);

    $platform = Arr::get($data, 'platform');
    $transaction_id = $platform === DevicePlatforms::ANDROID ?
        Arr::get($data, 'purchase_token') :
        Arr::get($data, 'transaction_id');

    $user->invoices()->create([
        'transaction_id' => $transaction_id,
        'platform' => $platform,
        'plan' => Arr::get($data, 'plan'),
        'amount_cents' => $plan->price * 100
    ]);

    DB::commit();

    return $subscription;
} catch (Exception $ex) {
    DB::rollBack();
    throw $ex;
}
```