'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  InfertilityVisual, InfertilityBoxes, InfertilityCost,
  STDVisual, STDBoxes, STDCost,
  ChronicVisual, ChronicBoxes, ChronicCost,
  GeneticVisual, GeneticBoxes, GeneticCost
} from './StoryVisuals';

const VISUALS_BY_ID = {
  1: { visual: InfertilityVisual, boxes: InfertilityBoxes, cost: InfertilityCost },
  2: { visual: STDVisual, boxes: STDBoxes, cost: STDCost },
  3: { visual: ChronicVisual, boxes: ChronicBoxes, cost: ChronicCost },
  4: { visual: GeneticVisual, boxes: GeneticBoxes, cost: GeneticCost }
};

const SUB_TABS = [
  { key: 'overview', label: 'Overview', shortLabel: 'Overview' },
  { key: 'reality', label: 'The Reality', shortLabel: 'Reality' },
  { key: 'prevention', label: 'Prevention', shortLabel: 'Prevention' }
];

export default function StoryTabs({ stories }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const active = stories[activeIndex];
  const { visual: Visual, boxes: Boxes, cost: Cost } = VISUALS_BY_ID[active.id] || {};

  const handleStoryChange = (index) => {
    setActiveIndex(index);
    setActiveSubTab('overview');
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-8 lg:gap-12 max-w-7xl mx-auto">
      {/* Story selector */}
      <div className="flex lg:flex-col gap-4 lg:gap-5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
        {stories.map((story, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={story.id}
              onClick={() => handleStoryChange(index)}
              className="flex-shrink-0 lg:flex-shrink text-left rounded-xl p-5 lg:p-6 transition-all duration-200 border"
              style={{
                background: isActive ? 'var(--surface)' : 'rgba(255,255,255,0.6)',
                borderColor: isActive ? 'var(--teal)' : 'var(--line)',
                boxShadow: isActive ? '0 4px 16px rgba(24,204,150,0.12)' : 'none',
                minWidth: '260px'
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl lg:text-3xl flex-shrink-0">{story.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm lg:text-base font-bold" style={{ color: isActive ? 'var(--ink)' : 'var(--muted)' }}>
                    {story.category}
                  </p>
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
                    {story.tabDescription}
                  </p>
                </div>
                {isActive && <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--teal-d)' }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Featured story card */}
      <div
        key={active.id}
        className="rounded-2xl border shadow-sm animate-fade-in-up lg:min-h-[500px] lg:flex lg:flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="px-6 lg:px-8 pt-6 lg:pt-8 pb-4 flex flex-col sm:flex-row sm:items-center gap-4 flex-shrink-0">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider flex-shrink-0 ${active.categoryColor}`}>
            <span className="text-xl">{active.emoji}</span>
            {active.category}
          </span>
          <div className="flex gap-1 rounded-lg p-1 flex-1" style={{ background: 'var(--paper)' }}>
            {SUB_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap"
                style={{
                  background: activeSubTab === tab.key ? 'var(--surface)' : 'transparent',
                  color: activeSubTab === tab.key ? 'var(--ink)' : 'var(--muted)',
                  boxShadow: activeSubTab === tab.key ? '0 1px 3px rgba(20,22,26,0.08)' : 'none'
                }}
              >
                <span className="lg:hidden">{tab.shortLabel}</span>
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 lg:px-8 pb-6 lg:pb-8 lg:flex-1">
          <div key={activeSubTab} className="space-y-6 lg:space-y-7 animate-fade-in">
            {activeSubTab === 'overview' && (
              <>
                <div>
                  <blockquote className="text-lg lg:text-xl italic leading-relaxed border-l-4 pl-5" style={{ color: 'var(--ink)', borderColor: 'var(--soft-teal)' }}>
                    {active.quote}
                  </blockquote>
                  <p className="text-sm mt-3 pl-6" style={{ color: 'var(--muted)' }}>{active.attribution}</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
                  <div className="flex flex-col justify-center">
                    <span className="text-5xl lg:text-6xl font-bold mb-3" style={{ color: 'var(--teal-d)' }}>{active.stat}</span>
                    <p className="text-base lg:text-lg leading-snug" style={{ color: 'var(--muted)' }}>{active.statDescription}</p>
                  </div>
                  {Visual && <div>{<Visual />}</div>}
                </div>
              </>
            )}

            {activeSubTab === 'reality' && Boxes && <Boxes />}

            {activeSubTab === 'prevention' && (
              <>
                <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
                  {Cost && <Cost />}
                  <div className="rounded-xl p-6 flex flex-col justify-center" style={{ background: 'var(--paper)' }}>
                    <span className="text-2xl mb-3">💡</span>
                    <p className="text-base lg:text-lg leading-relaxed" style={{ color: 'var(--ink)' }}>{active.insight}</p>
                  </div>
                </div>
                <p className="text-sm text-right" style={{ color: 'var(--muted)' }}>Source: {active.source}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
