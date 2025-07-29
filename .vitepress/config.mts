import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "TWD principles",
  description: "Test While Developing — A philosophy for writing tests while developing software.",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Manifesto', link: '/twd-manifesto' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'TWD Manifesto', link: '/twd-manifesto' },
          { text: 'Rethinking Testing: Why I Test While Developing', link: '/motivation' }
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'NestJS Testing Example', link: '/examples/nestjs-testing' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/kevinccbsg/twd-principles' }
    ]
  }
})
