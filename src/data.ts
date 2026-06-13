import { ProductItem, Measurement, Preference } from './types';

export const products: Record<string, ProductItem> = {
  'lavender-hoodie': {
    id: 'lavender-hoodie',
    name: 'Lavender Hoodie',
    category: 'Streetwear',
    price: 1499,
    originalPrice: 1699,
    rating: 4.6,
    reviewsCount: 128,
    imageUrl: 'https://images.unsplash.com/photo-1556821552-5ff63b1446d7?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1556821552-5ff63b1446d7?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1556821552-5ff63b1446d7?w=500&h=600&q=80&crop=entropy&cs=tinysrgb',
      'https://images.unsplash.com/photo-1578932750294-708994cc4054?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1506634215556-11fef7d1c69d?w=500&h=600&q=80'
    ],
    colors: ['Lavender', 'Mint Green', 'Beige', 'Black', 'Sky Blue'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inStock: true,
    stockLeft: 6,
    badge: 'Top Pick',
    details: [
      'Cotton Blend Fabric',
      'Relaxed Fit',
      'Hood with Drawstring',
      'Kangaroo Pocket',
      'Ribbed Cuffs & Hem'
    ]
  },
  'cargo-pants': {
    id: 'cargo-pants',
    name: 'Cargo Pants',
    category: 'Casual',
    price: 1899,
    rating: 4.5,
    reviewsCount: 92,
    imageUrl: 'https://images.unsplash.com/photo-1542272604-787c62d465d1?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1542272604-787c62d465d1?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1532635241649-7e968b12c664?w=500&h=600&q=80'
    ],
    colors: ['Beige', 'Black', 'Olive'],
    sizes: ['30', '32', '34', '36'],
    inStock: true,
    details: ['100% Cotton Twill', 'Multi-pocket Cargo configuration', 'Relaxed Streetwear Silhouette']
  },
  'white-sneakers': {
    id: 'white-sneakers',
    name: 'White Sneakers',
    category: 'Footwear',
    price: 2299,
    rating: 4.8,
    reviewsCount: 204,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1552062407-291826bca4c9?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1578932750294-708994cc4054?w=500&h=600&q=80'
    ],
    colors: ['White', 'Off-White', 'Black Accents'],
    sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
    inStock: true,
    details: ['Genuine Full-Grain Leather Upper', 'Cushioned Vulcanized Sole', 'Minimalist Stitch Detailing']
  },
  'crossbody-bag': {
    id: 'crossbody-bag',
    name: 'Crossbody Bag',
    category: 'Accessories',
    price: 999,
    rating: 4.4,
    reviewsCount: 65,
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1581235720704-06d3636d27f7?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=600&q=80'
    ],
    colors: ['Black', 'Navy', 'Graphite'],
    sizes: ['One Size'],
    inStock: true,
    details: ['Resistant Balistic Nylon construction', 'Secure zippered chambers', 'Adjustable heavy-woven strap']
  },
  'grey-jacket': {
    id: 'grey-jacket',
    name: 'Grey Jacket',
    category: 'Outerwear',
    price: 3499,
    rating: 4.7,
    reviewsCount: 88,
    imageUrl: 'https://images.unsplash.com/photo-1539533057867-fe50032efd77?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1539533057867-fe50032efd77?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1551028719-00167b16ebc5?w=500&h=600&q=80'
    ],
    colors: ['Classic Grey', 'Navy Blue'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    details: ['Premium Woolen Blend', 'Slim fit structure', 'Front chest welt pockets']
  },
  'denim-jacket': {
    id: 'denim-jacket',
    name: 'Streetwear Denim Jacket',
    category: 'Outerwear',
    price: 2199,
    rating: 4.6,
    reviewsCount: 142,
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16ebc5?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1551028719-00167b16ebc5?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1578932750294-708994cc4054?w=500&h=600&q=80'
    ],
    colors: ['Stonewash Blue', 'Classic Denim'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    details: ['Heavyweight cotton denim', 'Double chest utility flaps', 'Copper button hardware accents']
  },
  'beige-shirt': {
    id: 'beige-shirt',
    name: 'Smart Casual Beige Shirt',
    category: 'Casual wear',
    price: 1199,
    rating: 4.3,
    reviewsCount: 84,
    imageUrl: 'https://images.unsplash.com/photo-1596215578519-c21a6004885c?w=500&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1596215578519-c21a6004885c?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1578886385458-5db141f40a99?w=500&h=600&q=80',
      'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500&h=600&q=80'
    ],
    colors: ['Beige', 'Sand', 'Chambray'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    details: ['Woven linen-cotton blend', 'Breathable camp collar', 'Imitation horn buttons']
  }
};

export const initialMeasurements: Measurement[] = [
  { label: 'Height', value: '178 cm', iconName: 'height' },
  { label: 'Weight', value: '68 kg', iconName: 'fitness_center' },
  { label: 'Chest', value: '98 cm', iconName: 'checkroom' },
  { label: 'Waist', value: '82 cm', iconName: 'straighten' },
  { label: 'Inseam', value: '78 cm', iconName: 'architecture' }
];

export const initialPreferences: Preference[] = [
  { label: 'Style', value: 'Streetwear', iconName: 'style' },
  { label: 'Fit', value: 'Regular', iconName: 'fit_screen' },
  { label: 'Colors', value: 'Mix', iconName: 'palette' },
  { label: 'Occasion', value: 'Casual', iconName: 'event' }
];

export const recentActivity = [];

export const recentScans = [
  {
    id: 'sc-1',
    name: 'Beige Casual',
    time: '12 May, 11:20 AM',
    score: 8.5,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUgeGANrOmRNqcfu4jU6dHyOKzUkUmIFcfryWbaQQXJ-iF_6FuhspteyptU86lYM3jORcKT5qGeTsG9Z0PxxNEKOMUBmJfDIKAaAp5d9I1bCnJUGqHDmOLGnkVd3opGydX4vSn9aVNpUJVq8gwWnZFTIdpSijWXTJb71kZqVYWbQlpyEcdc7AwsfKN4XVjmxI0mIRylryRbM7LTx9RWlYvc5rGsaaUKU4Lyns_l-DSURVnRwklLsGzVJ-YazVRI1PMXDt9nq4NTbVa'
  },
  {
    id: 'sc-2',
    name: 'Lavender Street',
    time: '11 May, 07:45 PM',
    score: 9.2,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_DtlozI9DEUdYLQMIYnHfyp_fm3Cw5jsLiTmm4fF-DK-V1b1VUrpdO38t2top6aLDYoPLajt6CK3xvlfTqljQR1ztqY3Vf2-rI5VZ-80yTBizHhkphopu04Kc8tt_0uB8msBmbK_gludZp4Yclk-FLt5VxJnchoilYP_-XyBA2aIViuUjgm9TPfCJyyVzzcyG2f73mJiD0J_DmoLT0s-2WDDrjistvet5C8RPRMNkVXGOjY2H5tO5qZqyMN42Dxto1EwsXVxuC0iF'
  },
  {
    id: 'sc-3',
    name: 'Denim Vibes',
    time: '10 May, 04:10 PM',
    score: 8.8,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX9aJol6Krmm5VbrNIBE3Jah-4_TNSdaoEzCEuz1LtgIArYiTiqFhCbHqf7-UKcE9Lkg-S1B3PPHw00ISKzJc9YMfp-NwHR1VRcEUuVuZJkNNQrZgZwW84I1py3NV3z3Dgrf_8X_6bwfbY9m4zfoTPSUhve-7D3y-guULPbmhfu21pUSU0GAUIAFEK1RnlR3g-KW6Y9uCTIyYhepief0uH281I5860GxOLahrZqkZ9bqKqSMOWHGmf-AHEzjEGnCeNihIRFc8sGL9p'
  }
];

export const swatchImages: Record<string, string> = {
  'Lavender': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1DEvlAcsSjIBImBwutloA7GgJIOxP6Zdu4OS6c1dnCSREkV-2jg2jQJv4TALM43lEz2lSonhyKMVHqE-Qa3w1xkhYdiPojPZUoAOibd0p2ppj63LT_koyLp1KdUMA06ZmjYZsFEluXWz39S81MyF0iI4eGFLAO8cwHh_qBOAW-9-aWSRHfMz5Z1ZKVWA-Lvjx1mT9mWZuFyN_Bs5YJFOd8G6PHSo6lqNdJ9L7auhdV08L2L4zTjPkiJ0Vu4CRYOYPx_vnBUF90IKL',
  'Mint Green': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7_jncP4M8_hhf6hyr35rvURwwRqQWoguDNcL_xsoa6AVmbzYVgzytaJvERR17ssTy3UkLwGmO71OASwjRZ3V9UUu7kbadYvWbRAUZUp19buudkUZW-36JlAOUcMHrKG_IAHPQmnRyVM5UqEsYL5NCDMppxFmJszpFLxzyuhM9_iHJ6rZ4cJDzx2J0huZOf_t5odX7gCKN0TlgGg7a5JgU9P4ordESsraqYsPKayB786KPacFFfDr57cukNhbqZ67mkjyGnW2SBXzf',
  'Beige': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO_RSrNj3a9lQsd_mGtkSTfjlyUala4PUIDgBe1hPu9oU0bfm0e2dekjqlqUmoFqRVSt_-1WxTAeubBE0DQIW1-2_N7pOdb6_2RkL8WnPZhe4T7ri0tY8e0xOb3rtiLZMQm3jbTybQAoDG2PDvgaJBIIeY67Eb7L2DMXr7OS0CHBvLAcbXyQqcWvEXiu-wXKCwmbnxi-1yfA6RrO22zqEBDVLLXZFmXdgrkKbCdMGn66lkSpYkUbQQBTJHh2raKZP4FYWh6RMQm0BY',
  'Black': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuZU3gktYlA7wMNfXrkbOy-KP6yUxN5W3hLnzOo5TR8PERA5o1IJ10eZPoEnvGvHcaYJ-4TOe_phxD-vPyqxUfOQ_YT37Rc7m-znKCiG3H_ouKP8wfjNuB4OzMa2HvYLUqChUXNWz1RwZV5K8fOSE4cuPkRJnzcL1_CW1BhcI5Y0SMihHiEHYwi5f5H5lvfEHHGl0v_IFeJxeJ23EH1PSL-C_JU6PmgAbrzAXYZq3K8GNYtnn4xk8GECCdKzH8h5rhdw0htwy5KcSZ',
  'Sky Blue': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuWvv0rYH1H5LAe-fEdUPh3ahjwWDM3g9lTOLdiWcJ25n9ufaA-uXI8rM0Bg3lH57hqwzbLYnPoaknrGtey3uxCEixepIlkKFaf34E4nlcbZsn30TwcCEMi6g20ShBQfoDWSk4DxswZMR2PWoPOmD2OKkROuVSFuQkrTTEbmUQoVWPQQUUS0ZmH9OPbnMBMHrxP-nADCtVDQe64lj2r8kvC7sy27T03TI_mkue9HkhwjOfkqL8luEaZ7rfJcft4FMBhN1XHpwKpdNS'
};

export const swipeModels: Record<string, string> = {
  'Lavender': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAa7j2Q08nuchJnXnqIUa06NxmNavLWJ_vAvDJkkGqHlxbJMtqjGde7Pi06VWtt5pS_EQrG4QLhpYgomTop5MZ3Cv1rxDd_GgOfa9slQd5mMqPaFbVVUIuxs1jjH6mFIr96oP8gn8wUwKI8BJ5wW7IK9zjSqPZM2_HHyBm5lZ1mAjwhxqP8YUS2Y8aWM9TANQEmijEuZDn7zU75iYiqmmjJfpUWf7Go2wjs5ZJx1U8xPzTIRPalkmcbncx0m6S7EBGf6QW3IERapFVU',
  'Mint Green': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcUEi_nsnHa9pctxOSr137Q2sxBgQPnR3WIYrJ8VpULouZNaqwAoi16leulhEqOZIH4KS2c-2PDZvMbnVzXqXPmsGv1_SBECvpTF1PuUVzaCIhiYCu3Z5v_gC7HHgn8wvYep7u9o2B45oRIbcIouw8avkr2p0oKOl_-dZvwrBxUTKEL6FetzkJa5qIag7J1zPbASlQzqaccV06-hQlT0WYxPsbpc6Q6LZ69ziMJ2v4Z8gZb06qVAIjQazcot-Npm3tN1ygJrj7bg6R',
  'Beige': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCFSGDiIXtLBJAiPRem1rT1u1vy9hiZ4dJL2uSzgH-cYy9IzFBpw7sL1djGxdfSuV2Ny2sN3hNzOf68Bqa3E3lCWOyZ_MHpZ_TTdCQ0dFqvXp2IV4a2uETvozx8lKcpD9Z0KGksZG5bqEZkdaR08UbDKwK47U5Y4f0PF96GMriZJRDT8-TwfIrO7v0ddLDbE0aejwuxbldnzx77Z4Ac1E2rlZ1XAPq0owb6ekuuni7odR-ttYb42AjrjFk_pMQIFmkiKxSITBW3ShE',
  'Black': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBAz436PJ3rbXi1LBV-sa3cN9uLMLqpSMl88xEV3gJacDoqvdlBzW37YgFuzQkyI7p_9Kep1fRAB-uC7ofCfNQeDsELcdaKgoEn81Eek8bt8nNChouMNaEEOUka2CfaeoSTi5c70u6sMESaLmJCYQtYV_rYls4TGCvf8uSjdFAn9KKS0AguyjN-0jlYW4v-08SrEtgaJcxBcSGMONz9D1fXx87S5cBnKt07ubFlpA_LvVTRRNYnwtY7zbZ6A0fPRaOaa4yoMo3hdoNj',
  'Sky Blue': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpwyxXUs0knnxIRDGSMFkTtog-0obep1SK_TU4NyeRl8ntel_DLKuxHGdk9e5OI76kjvVIpUg8l7D_aqiwRx8lRRnobyjNnOtUVcGlL_uBNkCpzbyXO43S5RHAgbuhefXAYdAgT4snU1mYWOswZKWih4Cy8BXYfru0sKOap4dHyiQgQf3CkLlWOkE9ozuokB-Zas58Xt6gHr-UrUYWO8qzje8_fP0Ljn18qUAWSmka1RIF6AQ_yS9NrHEHTeiV1H29ktImz0MCN7wC'
};
