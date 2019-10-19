# Webhook

Webhook allows us to receive event/notification from each payment providers (Apple app store and Google play store).

::: tip
When setting up webhook URL, make sure the API is running with SSL since it is the basic requirement. [Letsencypt](https://letsencrypt.org/) offers free SSL certificate which you can install in your server.
:::

We used a Laravel PHP library to manage our client side webhook, this will help us to make the webhook processed in queue and monitor webhook payload.

[Spatie Client Webhook](https://github.com/spatie/laravel-webhook-client)