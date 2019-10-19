# IOS

Using the server-to-server notification service is optional but recommended, especially if you offer subscription services across multiple platforms and you need to keep the subscription records updated. After you set up your server, you can start receiving notifications at any time by adding a server URL in App Store Connect.

Use notifications along with receipt validation to validate a user's current subscription status and provide them with services or promotional offers based on that status.

For more information, refer to this [link](https://developer.apple.com/documentation/storekit/in-app_purchase/enabling_server-to-server_notifications).

## Configure Your Server to Receive Notifications

To receive server notifications from the App Store:

1. Support App Transport Security (ATS) on your server. The App Store must establish a secure network connection with your server by using ATS protocols before sending notifications. For more information, see [Preventing Insecure Network Connections](https://developer.apple.com/documentation/security/preventing_insecure_network_connections).
2. Determine a URL on your server to use for subscription status updates.
3. Configure the subscription status URL for your app in App Store Connect. For guidance, see [Enable status notifications for auto-renewable subscriptions](https://help.apple.com/app-store-connect/#/dev0067a330b).

Once you have taken these steps, your server is ready to receive server-to-server notifications.

## Receive Server-to-Server Notifications

The App Store delivers JSON objects via an HTTP POST to your server for notable subscription events. Your server is responsible for parsing, interpreting, and responding to all server-to-server notification posts.

The server-to-server notification is an HTTP POST.

## Respond to Server-to-Server Notifications

Your server should send an HTTP status code to indicate whether the server-to-server notification post succeeded:

* Send HTTP 200 if the post was successful. Your server is not required to return a data value.

* Send HTTP 50x or 40x to have the App Store retry the notification if the post was not successful. The App Store makes several attempts to retry the notification over a period of time but eventually stops after continued failed attempts.

## Process Events with Up-to-Date Information

Once you enable server-to-server notifications, you have up-to-date information on subscription status. Use the notification along with the latest receipt when you process events:

* In your app, verify the latest receipt with the App Store. See [Validating Receipts with the App Store](https://developer.apple.com/documentation/storekit/in-app_purchase/validating_receipts_with_the_app_store) for more information.
* Validate the user's current subscription status by cross-referencing the latest receipt with the latest server-to-server notification using the `original_transaction_id` key.

Here is the entire code snippet for handling App Store Server notification:

``` php
$payload = $this->webhookCall->payload;
$notificationType = Str::studly(
    strtolower(Arr::get($payload, 'notification_type'))
);

$response = ITunesValidator::setReceiptData(Arr::get(
    $payload,
    'latest_receipt',
    Arr::get($payload, 'latest_expired_receipt')
))
->validate();

if ($response->isValid()) {
    $this->receipt = $response->getReceipt();
    $transactionId = Arr::get($this->receipt, 'original_transaction_id');
    $this->invoice = Invoice::findByTransaction($transactionId);

    $productId = Arr::get($this->receipt, 'product_id');
    $this->plan = Plan::findBySlug($productId);

    if ($this->invoice && $this->plan) {
        call_user_func(array($this, "handle$notificationType"), $response);
    }
}
```