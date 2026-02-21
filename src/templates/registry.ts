import React from 'react';
import { z } from 'zod';

// ─── Template Category ──────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
    'case-study',
    'business-news',
    'tech-news',
    'data-visualization',
    'text-animation',
    'logo-reveal',
    'social-media-promo',
    'listicle-ranking',
    'lower-thirds',
    'startup-showcase',
    'social-hooks',
    'business-marketing',
    'platform-mockups',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type TemplateComponent = React.ComponentType<unknown>;

// ─── Template Metadata ──────────────────────────────────────

export interface TemplateMetadata {
    id: string;
    name: string;
    category: TemplateCategory;
    description: string;
    tags: string[];
    component: TemplateComponent;
    schema: z.AnyZodObject;
    defaultProps: Record<string, unknown>;
    durationInFrames: number;
    fps: number;
}

type RegisterTemplateInput<TProps extends object, TSchema extends z.AnyZodObject> = Omit<
    TemplateMetadata,
    'component' | 'schema' | 'defaultProps'
> & {
    component: React.ComponentType<TProps>;
    schema: TSchema;
    defaultProps: z.infer<TSchema>;
};

// ─── Master Registry ────────────────────────────────────────

const _registry: TemplateMetadata[] = [];

export function registerTemplate<TProps extends object, TSchema extends z.AnyZodObject>(
    meta: RegisterTemplateInput<TProps, TSchema>,
): void {
    _registry.push(meta as unknown as TemplateMetadata);
}

export function getTemplateRegistry(): TemplateMetadata[] {
    return _registry;
}

export function getTemplateById(id: string): TemplateMetadata | undefined {
    return _registry.find((t) => t.id === id);
}

export function getTemplatesByCategory(
    category: TemplateCategory,
): TemplateMetadata[] {
    return _registry.filter((t) => t.category === category);
}

export function getCategories(): TemplateCategory[] {
    return [...TEMPLATE_CATEGORIES];
}

export function getCategoryLabel(cat: TemplateCategory): string {
    const labels: Record<TemplateCategory, string> = {
        'case-study': 'Business Case Study',
        'business-news': 'Business News',
        'tech-news': 'Tech News',
        'data-visualization': 'Data Visualization',
        'text-animation': 'Text Animation',
        'logo-reveal': 'Logo Reveal / Intro',
        'social-media-promo': 'Social Media Promo',
        'listicle-ranking': 'Listicle / Ranking',
        'lower-thirds': 'Lower Thirds & Tickers',
        'startup-showcase': 'Startup Showcase',
        'social-hooks': 'Social Hooks & Cuts',
        'business-marketing': 'Business Marketing',
        'platform-mockups': 'Platform Mockups',
    };
    return labels[cat];
}
