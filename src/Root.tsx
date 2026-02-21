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

const CATEGORY_FOLDER_NAMES: Record<TemplateCategory, string> = {
  'case-study': 'CaseStudy',
  'business-news': 'BusinessNews',
  'tech-news': 'TechNews',
  'data-visualization': 'DataVisualization',
  'text-animation': 'TextAnimation',
  'logo-reveal': 'LogoReveal',
  'social-media-promo': 'SocialMediaPromo',
  'listicle-ranking': 'ListicleRanking',
  'lower-thirds': 'LowerThirds',
  'startup-showcase': 'StartupShowcase',
  'social-hooks': 'SocialHooks',
  'business-marketing': 'BusinessMarketing',
  'platform-mockups': 'PlatformMockups',
};

function groupByCategory(templates: TemplateMetadata[]): Record<TemplateCategory, TemplateMetadata[]> {
  const grouped = getCategories().reduce(
    (acc, cat) => {
      acc[cat] = [];
      return acc;
    },
    {} as Record<TemplateCategory, TemplateMetadata[]>,
  );

  for (const t of templates) {
    if (grouped[t.category]) {
      grouped[t.category].push(t);
    }
  }
  return grouped;
}

// ─── Import all templates (side-effect: each calls registerTemplate) ────

// Case Study
import './templates/business-marketing/AppStoreMockup';
import './templates/business-marketing/BeforeAfterSplit';
import './templates/business-marketing/BenefitCheckmarks';
import './templates/business-marketing/CaseStudyCards';
import './templates/business-marketing/ClientLogoGrid';
import './templates/business-marketing/ContactInfoCard';
import './templates/business-marketing/CustomerJourneyPath';
import './templates/business-marketing/DynamicBarChart';
import './templates/business-marketing/DynamicDonutChart';
import './templates/business-marketing/DynamicSalesFunnel';
import './templates/business-marketing/FacebookAdMockup';
import './templates/business-marketing/FeatureListPopups';
import './templates/business-marketing/FinancialBarChart';
import './templates/business-marketing/FlywheelModel';
import './templates/business-marketing/GoogleSearchMockup';
import './templates/business-marketing/GrowthLineGraph';
import './templates/business-marketing/HistoryMilestones';
import './templates/business-marketing/HorizontalRoadmap';
import './templates/business-marketing/IMessageMockup';
import './templates/business-marketing/InstagramAdMockup';
import './templates/business-marketing/InteractivePoll';
import './templates/business-marketing/LinkedInPostMockup';
import './templates/business-marketing/MarketShareBlocks';
import './templates/business-marketing/MarketingROICard';
import './templates/business-marketing/MultiLinkOutro';
import './templates/business-marketing/PricingComparisonTable';
import './templates/business-marketing/PricingTiers';
import './templates/business-marketing/ProductFeaturesGrid';
import './templates/business-marketing/ProductShowcase';
import './templates/business-marketing/RedditThreadMockup';
import './templates/business-marketing/ResourceDownloadList';
import './templates/business-marketing/ReviewMockup';
import './templates/business-marketing/SocialPostGrid';
import './templates/business-marketing/SpeakerRoster';
import './templates/business-marketing/SplitScreenMetrics';
import './templates/business-marketing/SponsorBanner';
import './templates/business-marketing/SprintProgressBar';
import './templates/business-marketing/StatGrid3x3';
import './templates/business-marketing/StepByStepProcess';
import './templates/business-marketing/TeamQuote';
import './templates/business-marketing/TeamRosterGrid';
import './templates/business-marketing/TechStackOrbit';
import './templates/business-marketing/TestimonialCarousel';
import './templates/business-marketing/TrustMetricsTicker';
import './templates/business-marketing/TwitterPostMockup';
import './templates/business-marketing/UsVsThemTable';
import './templates/business-marketing/VerticalTimeline';
import './templates/business-marketing/WebinarAgenda';
import './templates/business-marketing/YouTubePlayerMockup';
import './templates/business-news/BizNewsBreaking01';
import './templates/business-news/BizNewsEarnings01';
import './templates/business-news/BizNewsIPO01';
import './templates/business-news/BizNewsMarketUpdate01';
import './templates/business-news/BizNewsMerger01';
import './templates/business-news/BizNewsPolicy01';
import './templates/case-study/CaseStudyBeforeAfter01';
import './templates/case-study/CaseStudyCompanyProfile01';
import './templates/case-study/CaseStudyHero01';
import './templates/case-study/CaseStudyProblemSolution01';
import './templates/case-study/CaseStudyProcess01';
import './templates/case-study/CaseStudyQuote01';
import './templates/case-study/CaseStudyROI01';
import './templates/case-study/CaseStudyResults01';
import './templates/case-study/CaseStudyStats01';
import './templates/case-study/CaseStudyTestimonialGrid01';
import './templates/case-study/CaseStudyTimeline01';
import './templates/data-visualization/DataVizBarChart01';
import './templates/data-visualization/DataVizCounter01';
import './templates/data-visualization/DataVizDonut01';
import './templates/listicle-ranking/ListicleRanking01';
import './templates/logo-reveal/LogoRevealGlitch01';
import './templates/logo-reveal/LogoRevealMinimal01';
import './templates/lower-thirds/LowerThirds01';
import './templates/lower-thirds/LowerThirdsTopic01';
import './templates/social-hooks/ArticleHighlight01';
import './templates/social-hooks/AutoWhoosh01';
import './templates/social-hooks/BilingualOutro01';
import './templates/social-hooks/CensorStickers01';
import './templates/social-hooks/CollagePiP01';
import './templates/social-hooks/CutoutHook01';
import './templates/social-hooks/HeadlineCard01';
import './templates/social-hooks/LightLeakSmash01';
import './templates/social-hooks/MoneyRain01';
import './templates/social-hooks/PhoneCameo01';
import './templates/social-hooks/ProofTiles01';
import './templates/social-hooks/SplitCompare01';
import './templates/social-hooks/StampVerdict01';
import './templates/social-hooks/TimelineSteps01';
import './templates/social-hooks/ZoomReveal01';
import './templates/social-media-promo/SocialPromo01';
import './templates/social-media-promo/SocialPromoEvent01';
import './templates/startup-showcase/AppDemo01';
import './templates/startup-showcase/BoldPitch01';
import './templates/startup-showcase/CompanyHistory01';
import './templates/startup-showcase/CreativeStory01';
import './templates/startup-showcase/DataInsights01';
import './templates/startup-showcase/FounderJourney01';
import './templates/startup-showcase/LifestyleBrand01';
import './templates/startup-showcase/ProductLaunch01';
import './templates/startup-showcase/StartupVision01';
import './templates/startup-showcase/TechInnovation01';
import './templates/tech-news/TechNewsAIUpdate01';
import './templates/tech-news/TechNewsFunding01';
import './templates/tech-news/TechNewsLaunch01';
import './templates/tech-news/TechNewsOpenSource01';
import './templates/tech-news/TechNewsSecurity01';
import './templates/text-animation/TextAnimGradient01';
import './templates/text-animation/TextAnimTypewriter01';
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
