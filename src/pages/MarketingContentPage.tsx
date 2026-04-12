import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Megaphone, Loader2, Copy, CheckCircle, FileText, Share2, Linkedin, Twitter, Instagram, Facebook,
  Globe, Mail, Plus, X, Upload, Link, Newspaper, Award, Calendar, Video, Building2, Search, Sparkles, Tag
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ContentResponse {
  title: string;
  body: string;
  summary: string;
  hashtags: string[];
  callToAction: string;
  suggestedImageDescription?: string;
  platform: string;
  contentType: string;
  alternativeVersions?: { platform: string; body: string }[];
}

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin, twitter: Twitter, instagram: Instagram, facebook: Facebook, newsletter: Mail,
};

const MarketingContentPage = () => {
  const { activeCompanyId, data } = useData();
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);

  // Content generation
  const [contentType, setContentType] = useState('article');
  const [targetPlatform, setTargetPlatform] = useState('linkedin');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<ContentResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Intelligence sources
  const [topic, setTopic] = useState('');
  const [competitorInfo, setCompetitorInfo] = useState('');
  const [sectorNews, setSectorNews] = useState('');
  const [eventInfo, setEventInfo] = useState('');
  const [awardInfo, setAwardInfo] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [brandGuidelines, setBrandGuidelines] = useState('');
  const [offerDetails, setOfferDetails] = useState('');

  const loadSocialAccounts = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data: rows } = await supabase.from('social_media_accounts').select('*').eq('company_id', activeCompanyId);
    setSocialAccounts((rows as any[]) || []);
  }, [activeCompanyId]);

  useEffect(() => { loadSocialAccounts(); }, [loadSocialAccounts]);

  const addUrl = () => {
    if (newUrl.trim() && referenceUrls.length < 10) {
      setReferenceUrls(prev => [...prev, newUrl.trim()]);
      setNewUrl('');
    }
  };

  const removeUrl = (idx: number) => setReferenceUrls(prev => prev.filter((_, i) => i !== idx));

  const handleGenerate = async () => {
    if (!activeCompanyId) { toast({ title: 'No company selected', variant: 'destructive' }); return; }
    if (!topic.trim()) { toast({ title: 'Topic is required', variant: 'destructive' }); return; }

    setIsGenerating(true);
    try {
      const productsInfo = data.products.length > 0
        ? data.products.map(p => `${p.name} (${p.type}) - Avg value: €${p.averageValue}`).join('\n')
        : '';

      const platformAccount = socialAccounts.find(a => a.platform === targetPlatform);

      const marketIntelligence = [
        competitorInfo && `COMPETITOR INTELLIGENCE:\n${competitorInfo}`,
        sectorNews && `SECTOR NEWS & TRENDS:\n${sectorNews}`,
        eventInfo && `SECTOR EVENTS & SHOWS:\n${eventInfo}`,
        awardInfo && `SECTOR AWARDS & RECOGNITION:\n${awardInfo}`,
        websiteUrl && `COMPANY WEBSITE: ${websiteUrl}`,
        youtubeUrl && `COMPANY YOUTUBE: ${youtubeUrl}`,
        referenceUrls.length > 0 && `REFERENCE URLS:\n${referenceUrls.join('\n')}`,
        offerDetails && `OFFER / PROMOTION DETAILS:\n${offerDetails}`,
        uploadedText && `ADDITIONAL CONTENT / DOCUMENTS:\n${uploadedText}`,
      ].filter(Boolean).join('\n\n');

      const { data: result, error } = await supabase.functions.invoke('generate-content', {
        body: {
          contentType,
          topic,
          targetPlatform,
          companyProfile: data.companyProfile,
          productsData: productsInfo,
          brandGuidelines: brandGuidelines || platformAccount?.notes || '',
          additionalContext: marketIntelligence,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setGeneratedContent(result);
      toast({ title: '✅ Content generated', description: `${result.contentType} for ${result.platform}` });
    } catch (e: any) {
      console.error('Marketing content error:', e);
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copied` });
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company to use the Marketing Content Hub.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Marketing Content Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate newsletters, social posts, offer templates and more — powered by market intelligence, competitor data, events, and your own content.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT: Intelligence Sources + Generation Config (3 cols) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Topic & Content Config */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Content Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Main Topic / Subject *</Label>
                <VoiceTextInput value={topic} onChange={setTopic} placeholder="e.g., New product launch, industry trend, customer success, trade show follow-up..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Content Type</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contentType} onChange={e => setContentType(e.target.value)}>
                    <option value="article">Article / Thought Leadership</option>
                    <option value="update">Company Update</option>
                    <option value="product_news">Product News</option>
                    <option value="case_study">Case Study</option>
                    <option value="industry_insight">Industry Insight</option>
                    <option value="event">Event / Trade Show</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="offer_template">Offer / Promotion Template</option>
                    <option value="award_announcement">Award Announcement</option>
                    <option value="competitor_response">Competitive Positioning</option>
                    <option value="video_script">Video Script</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Target Platform</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={targetPlatform} onChange={e => setTargetPlatform(e.target.value)}>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter / X</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="newsletter">Newsletter (Email)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intelligence Sources Accordion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Market Intelligence Sources</CardTitle>
              <CardDescription className="text-xs">Provide context from multiple sources to generate richer, more relevant content.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="competitors">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Competitor Intelligence</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={competitorInfo} onChange={setCompetitorInfo} placeholder="Describe competitor activities, launches, pricing moves, market positioning..." rows={3} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sector">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Newspaper className="h-3.5 w-3.5" /> Sector News & Trends</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={sectorNews} onChange={setSectorNews} placeholder="Industry trends, regulatory changes, market forecasts, sector reports..." rows={3} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="events">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Events, Shows & Conferences</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={eventInfo} onChange={setEventInfo} placeholder="Trade shows attended/planned, conferences, webinars, speaking events..." rows={3} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="awards">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Award className="h-3.5 w-3.5" /> Awards & Recognition</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={awardInfo} onChange={setAwardInfo} placeholder="Industry awards, certifications, recognitions, rankings..." rows={2} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="urls">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Link className="h-3.5 w-3.5" /> Web & Video References</span></AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Company Website</Label>
                        <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://company.com" />
                      </div>
                      <div>
                        <Label className="text-xs">YouTube Channel</Label>
                        <Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@channel" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Additional Reference URLs</Label>
                      <div className="flex gap-2">
                        <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && addUrl()} />
                        <Button variant="outline" size="icon" onClick={addUrl} disabled={!newUrl.trim()}><Plus className="h-4 w-4" /></Button>
                      </div>
                      {referenceUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {referenceUrls.map((url, i) => (
                            <Badge key={i} variant="secondary" className="gap-1 text-[10px] max-w-[200px]">
                              <span className="truncate">{url}</span>
                              <button onClick={() => removeUrl(i)}><X className="h-2.5 w-2.5" /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="offer">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Offer / Promotion Details</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={offerDetails} onChange={setOfferDetails} placeholder="Pricing details, discount terms, bundle offers, limited-time promotions..." rows={3} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="content">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Loaded Content / Documents / Text</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={uploadedText} onChange={setUploadedText} placeholder="Paste or dictate content from documents, brochures, press releases, product descriptions, case studies..." rows={5} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="brand">
                  <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Brand Guidelines & Tone</span></AccordionTrigger>
                  <AccordionContent>
                    <VoiceTextInput value={brandGuidelines} onChange={setBrandGuidelines} placeholder="Tone of voice, key messages, brand values, visual identity notes..." rows={3} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Connected Platforms */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Connected Platforms:</span>
                <div className="flex gap-1.5">
                  {socialAccounts.length > 0 ? socialAccounts.map(a => {
                    const Icon = PLATFORM_ICONS[a.platform] || Globe;
                    return <Badge key={a.id} variant={a.is_enabled ? 'default' : 'outline'} className="gap-1 text-[10px]"><Icon className="h-3 w-3" /> {a.platform}</Badge>;
                  }) : <span className="text-xs text-muted-foreground">None — configure in Social Media settings</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()} className="w-full gap-2" size="lg">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? 'Generating Content...' : 'Generate Marketing Content'}
          </Button>
        </div>

        {/* RIGHT: Generated Content (2 cols) */}
        <div className="xl:col-span-2 space-y-4">
          {!generatedContent && !isGenerating && (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Fill in the content brief and intelligence sources, then generate your marketing content.</p>
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <p>📰 Newsletters & email campaigns</p>
                  <p>📱 Social media posts (LinkedIn, X, IG, FB)</p>
                  <p>🏷️ Offer & promotion templates</p>
                  <p>🎥 Video scripts</p>
                  <p>🏆 Award announcements</p>
                </div>
              </CardContent>
            </Card>
          )}

          {isGenerating && (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <Loader2 className="h-12 w-12 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Generating content from your intelligence sources...</p>
              </CardContent>
            </Card>
          )}

          {generatedContent && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {(() => { const Icon = PLATFORM_ICONS[generatedContent.platform] || Share2; return <Icon className="h-4 w-4 text-primary" />; })()}
                      {generatedContent.title}
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => copyToClipboard(generatedContent.body, 'Content')}>
                      {copied === 'Content' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                    </Button>
                  </div>
                  <CardDescription className="text-xs">{generatedContent.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  {generatedContent.platform === 'newsletter' ? (
                    <div className="prose prose-sm max-w-none text-sm text-foreground bg-muted/30 rounded-lg p-4 border" dangerouslySetInnerHTML={{ __html: generatedContent.body }} />
                  ) : (
                    <div className="text-sm text-foreground bg-muted/30 rounded-lg p-4 border whitespace-pre-wrap">{generatedContent.body}</div>
                  )}
                  {generatedContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {generatedContent.hashtags.map(h => <Badge key={h} variant="outline" className="text-[10px]">#{h}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {generatedContent.callToAction && (
                <Card><CardContent className="py-3"><p className="text-xs"><span className="font-medium text-foreground">CTA:</span> <span className="text-muted-foreground">{generatedContent.callToAction}</span></p></CardContent></Card>
              )}

              {generatedContent.suggestedImageDescription && (
                <Card><CardContent className="py-3"><p className="text-xs"><span className="font-medium text-foreground">Suggested Image:</span> <span className="text-muted-foreground">{generatedContent.suggestedImageDescription}</span></p></CardContent></Card>
              )}

              {generatedContent.alternativeVersions && generatedContent.alternativeVersions.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Adapted for Other Platforms</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {generatedContent.alternativeVersions.map((v, i) => {
                      const Icon = PLATFORM_ICONS[v.platform] || Share2;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="gap-1 text-[10px]"><Icon className="h-3 w-3" /> {v.platform}</Badge>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(v.body, v.platform)}>
                              {copied === v.platform ? <CheckCircle className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />} Copy
                            </Button>
                          </div>
                          <div className="text-xs text-foreground bg-muted/30 rounded p-2 border whitespace-pre-wrap">{v.body}</div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingContentPage;
