# Android

Google Play Billing provides server push notifications that let you monitor state changes for Play-managed subscriptions. By enabling real-time developer notifications, you'll receive a purchase token directly from Cloud Pub/Sub anytime there is an update to an existing subscription.

To enable this capability:

1. Setup [Cloud Pub/Sub](https://cloud.google.com/pubsub/) using your own [Google Cloud Platform (GCP)](https://cloud.google.com/) project.
2. Enable real-time developer notifications for your Android app.

## Setting up Google PubSub

Cloud Pub/Sub is a fully-managed real-time messaging service allowing you to send and receive messages between independent applications. It delivers low-latency, durable messaging that helps you quickly integrate systems hosted on the Google Cloud Platform and externally.

Google Play Billing uses the Cloud Pub/Sub to publish push notifications on topics to which you subscribe.

### Create a topic

To start receiving the notifications, you need to create a topic to which the Google Play Billing should publish the notifications. To create a topic:

1. Read the instructions in [Create the topic](https://cloud.google.com/pubsub/docs/quickstart-console#create_a_topic).
2. Use the Google Cloud Platform Console to create the topic.

### Create a Pub/Sub subscription

To receive messages published to a topic, you must create a Pub/Sub subscription to that topic. To create a Pub/Sub subscription:

1. Read the [Cloud Pub/Sub Subscriber Guide](https://cloud.google.com/pubsub/docs/subscriber) to determine whether to configure the subscription as either a push subscription or pull subscription. A pull subscription requires your secure backend server to initiate requests to the Cloud Pub/Sub server to retrieve messages. A push subscription requires Cloud Pub/Sub to initiate requests to your secure backend server to deliver messages.
2. Read the instructions in [Add a subscription](https://cloud.google.com/pubsub/docs/quickstart-console#add_a_subscription).
3. Use the [Google Cloud Platform Console](https://console.cloud.google.com) to create the subscription.

### Grant publish rights on your topic

Cloud Pub/Sub requires that you grant Google Play Billing privileges to publish notifications to your topic using the following steps:

1. Open the [Google Cloud Console](https://console.cloud.google.com/home/dashboard).
2. Select your project and click Pub/Sub in the left-hand navigation.
3. Find your topic and open the permissions details.

![Image](https://developer.android.com/images/google/play/billing/realtime-dev-notif-pubsub-topic-permissions.png)
4. Add the service account `google-play-developer-notifications@system.gserviceaccount.com` and grant it the role of Pub/Sub Publisher.

![Image](https://developer.android.com/images/google/play/billing/realtime-dev-notif-pubsub-topic-role.png)
5. Save to complete topic set up.

![Image](https://developer.android.com/images/google/play/billing/realtime-dev-notif-topic-configured.png)


### Enable real-time developer notifications for your app

To enable real-time developer notifications for your app:

1. Open the [Google Play Console](https://play.google.com/apps/publish/).
2. Select your Android app.
3. Navigate to the **Development tools > Services & APIs** page.
4. Scroll to the **Real-time developer notifications** section at the bottom of the page.

![Image](https://developer.android.com/images/google/play/billing/rtdn-setup.png)

5. In the **Topic name** field, enter the full Cloud Pub/Sub topic name that you configured earlier. The topic name should be in the format of `projects/{project_id}/topics/{topic_name}` where `project_id` is the unique identifier for your project and `topic_name` is the name of the topic created earlier.

6. Click **Send Test Message** to send a test message. Performing a test publish helps ensure that everything is setup and configured properly. If the test publish succeeds, a message is displayed stating that the test publish was successful. If you have a subscriber running for this topic, it should receive this test message. If the publish fails, an error is shown. Ensure that the topic name is correct and that `google-play-developer-notifications@system.gserviceaccount.com` service account has Pub/Sub Publisher access to the topic.
7. Click **Update Topic**

For more information about this documentation please visit this link, [Add real-time developer notifications](https://developer.android.com/google/play/billing/realtime_developer_notifications)

## Handling Webhook Notification

This explains how we handle webhook event fired from Google PubSub to our webhook URL.

1. We extracted the Base64 encoded data passed from Google PubSub
2. We get the subscription notification data. This is how subscription notification looks like.
``` php
[
  "version" => "1.0"
  "notificationType" => 3
  "purchaseToken" => "bgodibjhklpmpphnonpfhkkg.AO-J1OxmovNIgvVCrG9Vz4H-S4kEhBpR--4kWevSP04I1LGKhwSnA9AluwEpuEwQa05FQpdafJwd-cYQre9grTv8hEM6Zkye1X6jXjmp6IV7VxBXfk9cs66L6-E9vNJ2bCipI6x7-F7U"
  "subscriptionId" => "concha_club_1"
]
```
3. We then fetch the purchase token and subscription ID (Plan ID) so we can query who's user owns the webhook.
4. Then we determine what is the notification type of the webhook based on the `notificationType`. Refer to this [link](https://developer.android.com/google/play/billing/realtime_developer_notifications#json_specification) for the list of all notification types.
5. We also validate the webhook payload against the Google Play to make sure it is authorized.
6. After getting all the necessary information, the webhook will be now processed based on their corresponding action.

Here is the entire code snippet for handling the webhook.

``` php
$payload = $this->webhookCall->payload;
$data = json_decode(base64_decode(Arr::get($payload, 'message.data')), true);

try {
    $subscriptionNotification = Arr::get($data, 'subscriptionNotification');

    if (!$subscriptionNotification) {
        return;
    }

    $this->plan = Plan::findBySlug(Arr::get($subscriptionNotification, 'subscriptionId'));
    $this->invoice = Invoice::findByTransaction(Arr::get($subscriptionNotification, 'purchaseToken'));

    PlayValidator::setPackageName(Arr::get($data, 'packageName'))
        ->setProductId(Arr::get($subscriptionNotification, 'subscriptionId'))
        ->setPurchaseToken(Arr::get($subscriptionNotification, 'purchaseToken'))
        ->validateSubscription();

    $notificationTypeId = SubscriptionNotificationType::getDescription(
        Arr::get($subscriptionNotification, 'notificationType')
    );
    $notificationType = Str::studly(
        strtolower($notificationTypeId)
    );

    if ($notificationType && $this->plan && $this->invoice) {
        // call class function base on notification type
        call_user_func(array($this, "handle$notificationType"));
    }
} catch (Exception $ex) {
    return;
}
```