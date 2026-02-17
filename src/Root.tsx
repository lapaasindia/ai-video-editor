import './index.css';
import React, { Fragment } from 'react';
import { Composition, Folder } from 'remotion';
import type { ComponentType } from 'react';
import { z } from 'zod';
import { ASPECT_RATIOS } from './lib/constants';
import {
  BackgroundControlsProvider,
  type BackgroundControlProps,
} from './lib/background';
import {
  getTemplateRegistry,
  getCategories,
  type TemplateCategory,
  type TemplateMetadata,
} from './templates/registry';

const backgroundControlsSchema = z.object({
  showBackground: z.boolean().default(true),
  transparentBackground: z.boolean().default(false),
});

const withBackgroundControls = (
  Component: ComponentType<unknown>,
): ComponentType<Record<string, unknown> & BackgroundControlProps> => {
  const Wrapped: React.FC<Record<string, unknown> & BackgroundControlProps> = ({
    showBackground = true,
    transparentBackground = false,
    ...rest
  }) => {
    const controls = {
      showBackground,
      transparentBackground,
    };

    const transparentCanvas = controls.transparentBackground || !controls.showBackground;

    return (
      <BackgroundControlsProvider value={controls}>
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            ['--template-bg' as string]: transparentCanvas ? 'transparent' : '#0F0F0F',
            ['--template-bg-alt' as string]: transparentCanvas ? 'transparent' : '#121212',
            ['--template-bg-mid' as string]: transparentCanvas ? 'transparent' : '#0a1a0f',
          }}
        >
          <Component {...rest} />
        </div>
      </BackgroundControlsProvider>
    );
  };

  Wrapped.displayName = `WithBackgroundControls(${Component.displayName ?? Component.name ?? 'Template'})`;
  return Wrapped;
};

// ─── Import all templates (side-effect: each calls registerTemplate) ────

// Case Study
import './templates/case-study/CaseStudyHero01';
import './templates/case-study/CaseStudyStats01';
import './templates/case-study/CaseStudyTimeline01';
import './templates/case-study/CaseStudyBeforeAfter01';
import './templates/case-study/CaseStudyQuote01';
import './templates/case-study/CaseStudyProblemSolution01';
import './templates/case-study/CaseStudyResults01';
import './templates/case-study/CaseStudyCompanyProfile01';
import './templates/case-study/CaseStudyProcess01';
import './templates/case-study/CaseStudyROI01';
import './templates/case-study/CaseStudyTestimonialGrid01';

// Business News
import './templates/business-news/BizNewsBreaking01';
import './templates/business-news/BizNewsMarketUpdate01';
import './templates/business-news/BizNewsEarnings01';
import './templates/business-news/BizNewsMerger01';
import './templates/business-news/BizNewsIPO01';
import './templates/business-news/BizNewsPolicy01';

// Tech News
import './templates/tech-news/TechNewsLaunch01';
import './templates/tech-news/TechNewsFunding01';
import './templates/tech-news/TechNewsAIUpdate01';
import './templates/tech-news/TechNewsOpenSource01';
import './templates/tech-news/TechNewsSecurity01';

// Data Visualization
import './templates/data-visualization/DataVizBarChart01';
import './templates/data-visualization/DataVizDonut01';
import './templates/data-visualization/DataVizCounter01';

// Text Animation
import './templates/text-animation/TextAnimGradient01';
import './templates/text-animation/TextAnimTypewriter01';

// Logo Reveal
import './templates/logo-reveal/LogoRevealMinimal01';
import './templates/logo-reveal/LogoRevealGlitch01';

// Social Media Promo
import './templates/social-media-promo/SocialPromo01';
import './templates/social-media-promo/SocialPromoEvent01';

// Listicle / Ranking
import './templates/listicle-ranking/ListicleRanking01';

// Lower Thirds
import './templates/lower-thirds/LowerThirds01';
import './templates/lower-thirds/LowerThirdsTopic01';

// Startup Showcase
import './templates/startup-showcase/StartupVision01';
import './templates/startup-showcase/BoldPitch01';
import './templates/startup-showcase/ProductLaunch01';
import './templates/startup-showcase/TechInnovation01';
import './templates/startup-showcase/CreativeStory01';
import './templates/startup-showcase/DataInsights01';
import './templates/startup-showcase/FounderJourney01';
import './templates/startup-showcase/LifestyleBrand01';
import './templates/startup-showcase/CompanyHistory01';
import './templates/startup-showcase/AppDemo01';

// Social Hooks
import './templates/social-hooks/CutoutHook01';
import './templates/social-hooks/HeadlineCard01';
import './templates/social-hooks/LightLeakSmash01';
import './templates/social-hooks/ZoomReveal01';
import './templates/social-hooks/CollagePiP01';
import './templates/social-hooks/CensorStickers01';
import './templates/social-hooks/MoneyRain01';
import './templates/social-hooks/ArticleHighlight01';
import './templates/social-hooks/PhoneCameo01';
import './templates/social-hooks/BilingualOutro01';
import './templates/social-hooks/ProofTiles01';
import './templates/social-hooks/SplitCompare01';
import './templates/social-hooks/StampVerdict01';
import './templates/social-hooks/TimelineSteps01';
import './templates/social-hooks/AutoWhoosh01';

// ─── Helpers ────────────────────────────────────────────────

// Remotion Folder names only allow a-z, A-Z, 0-9, -
const CATEGORY_FOLDER_NAMES: Record<TemplateCategory, string> = {
  'case-study': 'Case-Study',
  'business-news': 'Business-News',
  'tech-news': 'Tech-News',
  'data-visualization': 'Data-Visualization',
  'text-animation': 'Text-Animation',
  'logo-reveal': 'Logo-Reveal',
  'social-media-promo': 'Social-Media-Promo',
  'listicle-ranking': 'Listicle-Ranking',
  'lower-thirds': 'Lower-Thirds',
  'startup-showcase': 'Startup-Showcase',
  'social-hooks': 'Social-Hooks',
};

function groupByCategory(
  templates: TemplateMetadata[],
): Record<TemplateCategory, TemplateMetadata[]> {
  const grouped = {} as Record<TemplateCategory, TemplateMetadata[]>;
  for (const cat of getCategories()) {
    grouped[cat] = [];
  }
  for (const t of templates) {
    grouped[t.category].push(t);
  }
  return grouped;
}

// ─── Root Component ─────────────────────────────────────────
export const RemotionRoot: React.FC = () => {
  const registry = getTemplateRegistry();
  const grouped = groupByCategory(registry);

  return (
    <>
      {getCategories().map((category) => {
        const templates = grouped[category];
        if (templates.length === 0) return null;

        return (
          <Folder key={category} name={CATEGORY_FOLDER_NAMES[category]}>
            {templates.map((t) => {
              const ComponentWithControls = withBackgroundControls(t.component);
              const schemaWithControls = t.schema.extend(backgroundControlsSchema.shape);
              const defaultPropsWithControls = {
                ...t.defaultProps,
                ...backgroundControlsSchema.parse({}),
              };

              return (
              <Fragment key={t.id}>
                <Composition
                  key={`${t.id}-landscape`}
                  id={`${t.id}-landscape`}
                  component={ComponentWithControls}
                  schema={schemaWithControls}
                  defaultProps={defaultPropsWithControls}
                  durationInFrames={t.durationInFrames}
                  fps={t.fps}
                  width={ASPECT_RATIOS.LANDSCAPE.width}
                  height={ASPECT_RATIOS.LANDSCAPE.height}
                />
                <Composition
                  key={`${t.id}-portrait`}
                  id={`${t.id}-portrait`}
                  component={ComponentWithControls}
                  schema={schemaWithControls}
                  defaultProps={defaultPropsWithControls}
                  durationInFrames={t.durationInFrames}
                  fps={t.fps}
                  width={ASPECT_RATIOS.PORTRAIT.width}
                  height={ASPECT_RATIOS.PORTRAIT.height}
                />
              </Fragment>
              );
            })}
          </Folder>
        );
      })}
    </>
  );
};
