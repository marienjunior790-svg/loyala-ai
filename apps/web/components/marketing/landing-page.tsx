import { MarketingNav } from './marketing-nav';
import { HeroSection } from './hero-section';
import { ProblemSolutionSection } from './problem-solution';
import { BenefitsSection } from './benefits-section';
import { DemoSection } from './demo-section';
import { PricingSection } from './pricing-section';
import { MarketingFooter } from './marketing-footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main id="main-content">
        <HeroSection />
        <ProblemSolutionSection />
        <BenefitsSection />
        <DemoSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
