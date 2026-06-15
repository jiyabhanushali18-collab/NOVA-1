export interface FashionRule {
  id: string;
  rule_type: string;
  condition: string;
  recommendation: string[];
  avoid?: string[];
  tags?: string[];
  description?: string;
}

export interface FashionOutfitTemplate {
  id: string;
  name: string;
  top: string;
  bottom: string;
  shoes: string;
  accessories?: string[];
  occasion: string;
  colors?: string[];
  tags?: string[];
}

export interface ColorCombo {
  id: string;
  combination: string[];
  tags?: string[];
}

export interface FashionMistake {
  id: string;
  rule: string;
  description: string;
  tags?: string[];
}

export const fashionRules: FashionRule[] = [
  {
    id: 'skin_deep_brown',
    rule_type: 'skin_tone',
    condition: 'deep_brown',
    recommendation: ['White', 'Cream', 'Beige', 'Olive Green', 'Emerald Green', 'Burgundy', 'Maroon', 'Rust', 'Navy Blue', 'Black'],
    avoid: ['Neon Green', 'Neon Yellow', 'Very Pale Brown'],
    tags: ['skin tone', 'deep brown', 'color palette'],
  },
  {
    id: 'skin_wheatish',
    rule_type: 'skin_tone',
    condition: 'wheatish',
    recommendation: ['White', 'Navy', 'Olive', 'Mustard', 'Teal', 'Burgundy', 'Charcoal Grey', 'Lavender'],
    avoid: ['Skin-tone Beige', 'Dull Yellow'],
    tags: ['skin tone', 'wheatish', 'color palette'],
  },
  {
    id: 'skin_fair',
    rule_type: 'skin_tone',
    condition: 'fair',
    recommendation: ['Navy', 'Black', 'Forest Green', 'Burgundy', 'Dark Brown', 'Deep Purple'],
    avoid: ['Very Light White', 'Pastel Yellow'],
    tags: ['skin tone', 'fair', 'color palette'],
  },
  {
    id: 'hair_black',
    rule_type: 'hair_color',
    condition: 'black',
    recommendation: ['White', 'Beige', 'Olive', 'Burgundy', 'Navy', 'Grey'],
    tags: ['hair color', 'black hair', 'contrast'],
  },
  {
    id: 'hair_brown',
    rule_type: 'hair_color',
    condition: 'brown',
    recommendation: ['Forest Green', 'Cream', 'Rust', 'Navy'],
    tags: ['hair color', 'brown hair'],
  },
  {
    id: 'eyes_dark_brown',
    rule_type: 'eye_color',
    condition: 'dark_brown',
    recommendation: ['Olive Green', 'Burgundy', 'Navy', 'Charcoal'],
    tags: ['eye color', 'dark brown eyes'],
  },
  {
    id: 'eyes_hazel',
    rule_type: 'eye_color',
    condition: 'hazel',
    recommendation: ['Green', 'Rust', 'Brown'],
    tags: ['eye color', 'hazel eyes'],
  },
  {
    id: 'body_skinny',
    rule_type: 'body_shape',
    condition: 'skinny',
    recommendation: ['Oversized Tees', 'Layered Shirts', 'Cargo Pants', 'Straight Fit Jeans'],
    avoid: ['Super Skinny Jeans', 'Extremely Tight Shirts'],
    tags: ['body shape', 'skinny', 'fit'],
  },
  {
    id: 'body_athletic',
    rule_type: 'body_shape',
    condition: 'athletic',
    recommendation: ['Slim Fit Shirts', 'Polo Tees', 'Straight Jeans', 'Chinos'],
    avoid: ['Extremely Baggy Clothing'],
    tags: ['body shape', 'athletic', 'fit'],
  },
  {
    id: 'body_heavy',
    rule_type: 'body_shape',
    condition: 'heavy',
    recommendation: ['Vertical Patterns', 'Dark Colors', 'Straight Fit Pants', 'Structured Jackets'],
    avoid: ['Horizontal Stripes', 'Skinny Fits'],
    tags: ['body shape', 'heavy', 'fit'],
  },
  {
    id: 'height_short',
    rule_type: 'height',
    condition: 'short',
    recommendation: ['Monochrome Outfits', 'Slim Fit', 'Vertical Stripes', 'Cropped Jackets'],
    avoid: ['Huge Oversized Fits', 'Low Waist Pants'],
    tags: ['height', 'short', 'proportion'],
  },
  {
    id: 'height_tall',
    rule_type: 'height',
    condition: 'tall',
    recommendation: ['Layering', 'Oversized Fits', 'Cargo Pants', 'Wide Leg Jeans'],
    avoid: ['Ultra Skinny Jeans'],
    tags: ['height', 'tall', 'proportion'],
  },
  {
    id: 'occasion_college',
    rule_type: 'occasion',
    condition: 'college',
    recommendation: ['Oversized Tee + Cargo', 'Graphic Tee + Baggy Jeans', 'Hoodie + Sneakers'],
    tags: ['occasion', 'college', 'casual'],
  },
  {
    id: 'occasion_date_night',
    rule_type: 'occasion',
    condition: 'date_night',
    recommendation: ['White Shirt + Black Trousers', 'Polo Tee + Chinos', 'Cuban Collar Shirt'],
    tags: ['occasion', 'date night', 'evening'],
  },
  {
    id: 'occasion_office',
    rule_type: 'occasion',
    condition: 'office',
    recommendation: ['Oxford Shirt', 'Formal Trousers', 'Loafers'],
    tags: ['occasion', 'office', 'formal'],
  },
  {
    id: 'occasion_wedding',
    rule_type: 'occasion',
    condition: 'wedding',
    recommendation: ['Kurta + Nehru Jacket', 'Sherwani', 'Embroidered Kurta'],
    tags: ['occasion', 'wedding', 'ethnic'],
  },
  {
    id: 'style_streetwear',
    rule_type: 'style_category',
    condition: 'streetwear',
    recommendation: ['Oversized Tee', 'Baggy Jeans', 'Cap', 'Sneakers', 'Chain'],
    tags: ['style', 'streetwear'],
  },
  {
    id: 'style_old_money',
    rule_type: 'style_category',
    condition: 'old_money',
    recommendation: ['Linen Shirt', 'Polo', 'Pleated Trousers', 'Loafers', 'Watch'],
    tags: ['style', 'old money', 'minimal'],
  },
  {
    id: 'style_quiet_luxury',
    rule_type: 'style_category',
    condition: 'quiet_luxury',
    recommendation: ['Premium Solid Tee', 'Straight Trousers', 'Minimal Sneakers'],
    tags: ['style', 'quiet luxury', 'minimalism'],
  },
  {
    id: 'style_korean',
    rule_type: 'style_category',
    condition: 'korean_fashion',
    recommendation: ['Oversized Shirt', 'Wide Trousers', 'Layering'],
    tags: ['style', 'korean fashion'],
  },
  {
    id: 'season_summer',
    rule_type: 'season',
    condition: 'summer',
    recommendation: ['Cotton', 'Linen', 'Light Colors'],
    tags: ['season', 'summer', 'cooling'],
    description: 'Summer styling favors breathable fabrics and bright palettes.',
  },
  {
    id: 'season_winter',
    rule_type: 'season',
    condition: 'winter',
    recommendation: ['Layering', 'Jackets', 'Hoodies'],
    tags: ['season', 'winter', 'warmth'],
    description: 'Winter style should focus on structure, texture, and layering.',
  },
];

export const outfitTemplates: FashionOutfitTemplate[] = [
  {
    id: 'casual_white_tee',
    name: 'Casual White Tee',
    top: 'White Oversized Tee',
    bottom: 'Light Blue Jeans',
    shoes: 'White Sneakers',
    occasion: 'college',
    colors: ['White', 'Light Blue', 'Beige'],
    tags: ['casual', 'college', 'streetwear'],
  },
  {
    id: 'streetwear_black',
    name: 'Streetwear Black',
    top: 'Black Graphic Tee',
    bottom: 'Baggy Grey Jeans',
    shoes: 'Chunky Sneakers',
    accessories: ['Cap', 'Chain'],
    occasion: 'streetwear',
    colors: ['Black', 'Grey'],
    tags: ['streetwear', 'edgy'],
  },
  {
    id: 'old_money_beige',
    name: 'Old Money Beige',
    top: 'White Linen Shirt',
    bottom: 'Pleated Beige Trousers',
    shoes: 'Brown Loafers',
    occasion: 'office',
    colors: ['White', 'Beige', 'Brown'],
    tags: ['old money', 'minimal'],
  },
];

export const colorCombos: ColorCombo[] = [
  { id: 'white_black', combination: ['White Shirt', 'Black Trousers'], tags: ['classic', 'monochrome', 'office'] },
  { id: 'white_beige', combination: ['White Shirt', 'Beige Chinos'], tags: ['soft', 'summer', 'casual'] },
  { id: 'white_navy', combination: ['White Tee', 'Navy Jeans'], tags: ['timeless', 'contrast'] },
  { id: 'black_beige', combination: ['Black Tee', 'Beige Cargo Pants'], tags: ['streetwear', 'contrast'] },
  { id: 'olive_black', combination: ['Olive Shirt', 'Black Jeans'], tags: ['earthy', 'all-season'] },
  { id: 'burgundy_black', combination: ['Burgundy Top', 'Black Trousers'], tags: ['evening', 'bold'] },
  { id: 'skyblue_white', combination: ['Sky Blue Shirt', 'White Denim'], tags: ['summer', 'fresh'] },
  { id: 'lavender_grey', combination: ['Lavender Top', 'Grey Pants'], tags: ['soft', 'modern'] },
];

export const fashionMistakes: FashionMistake[] = [
  { id: 'mistake_many_colors', rule: 'More than 3 dominant colors is usually bad.', description: 'Keep outfits balanced by limiting dominant hues to three or fewer.', tags: ['color balance', 'outfit rule'] },
  { id: 'mistake_belt_shoes', rule: 'Belt should match shoe color.', description: 'Matching belt and shoe tones creates a polished silhouette.', tags: ['accessories', 'formal'] },
  { id: 'mistake_oversized_combo', rule: 'Oversized top + slim bottom works.', description: 'Balance big tops with more fitted bottoms for proportion.', tags: ['fit', 'balance'] },
  { id: 'mistake_oversized_oversized', rule: 'Oversized top + oversized bottom requires balance.', description: 'Use a strong structure or layers to keep volume intentional.', tags: ['fit', 'streetwear'] },
  { id: 'mistake_white_sneakers', rule: 'White sneakers work with most casual outfits.', description: 'White footwear is a versatile anchor for everyday looks.', tags: ['footwear', 'casual'] },
  { id: 'mistake_black_night', rule: 'Black shirts look stronger at night.', description: 'Use darker tops for evening settings to add drama.', tags: ['evening', 'color'] },
  { id: 'mistake_vertical_stripes', rule: 'Vertical stripes elongate body.', description: 'Choose vertical lines to create a taller look.', tags: ['patterns', 'proportion'] },
  { id: 'mistake_horizontal_stripes', rule: 'Horizontal stripes widen body.', description: 'Avoid wide horizontal stripes if you want a slimmer silhouette.', tags: ['patterns', 'proportion'] },
  { id: 'mistake_monochrome', rule: 'Monochrome outfits make people appear taller.', description: 'Single-color looks create a clean vertical line from head to toe.', tags: ['monochrome', 'proportion'] },
];
