module.exports = {
  router: [
    {
      root: '',
      pages: {
        'pages/home/index': '/pages/home/index',
        'pages/extra/index': '@extra/pages/x/index',
      },
    },
    {
      root: 'pkg-a',
      pages: {
        index: '/pkg-a/index',
      },
    },
    {
      root: 'pkg-b',
      pages: {
        index: '/pkg-b/index',
      },
    },
    {
      root: 'pkg-ind',
      pages: {
        index: '/pkg-ind/index',
      },
      independent: true,
    },
  ],
}
