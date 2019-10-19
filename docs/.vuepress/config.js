module.exports = {
  title: 'In-app Payment',
  description: 'Backend API Documentation for In-app Payments',
  themeConfig: {
    smoothScroll: true,
    displayAllHeaders: true,
    nav: [
      { text: 'API', link: '/api' },
      { text: 'Laravel', link: 'https://laravel.com/docs/6.x', target: '_blank' }
    ],
    sidebar: [
      '/',
      '/getting-started',
      {
        title: 'Webhooks',
        path: '/webhooks/',
        collapsable: false,
        children: [
          'webhooks/android',
          'webhooks/ios'
        ]
      },
      '/plans'
    ]
  },
  markdown: {
    lineNumbers: true
  }
}
