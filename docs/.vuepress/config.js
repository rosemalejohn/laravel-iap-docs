module.exports = {
  title: 'In-app Payment',
  description: 'Backend API Documentation for In-app Payments',
  themeConfig: {
    lastUpdated: true,
    smoothScroll: false,
    displayAllHeaders: true,
    nav: [
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
      '/plans',
      '/api'
    ]
  },
  markdown: {
    lineNumbers: true
  },
  plugins: [
    '@vuepress/back-to-top'
  ]
}
