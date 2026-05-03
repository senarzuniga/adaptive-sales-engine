import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, ChevronDown, History, Lightbulb, Play, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/store/DataStore';
import { buildPanelContext } from '@/lib/panelContext';
import { loadPromptHistory } from '@/lib/goaPersistence';
import { executeGlobalOrchestration } from '@/agents/goa/globalOrchestrationAgent';

export function PanelPromptBox() {
  const location = useLocation();
  const {
    activeCompanyId,
    data,
    setOrders,
    setOpportunities,
    setProducts,
    setStrategy,
    setLeads,
    setContacts,
  } = useData();

  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestOnly, setSuggestOnly] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<{
    confidence: number;
    safeMode: boolean;
    summary: string;
    changes: string[];
    suggestions: string[];
  } | null>(null);

  const panelMeta = useMemo(() => buildPanelContext({
    route: location.pathname,
    companyId: activeCompanyId || '',
    userPrompt: prompt,
    data: {
      orders: data.orders,
      opportunities: data.opportunities,
      products: data.products,
      strategy: data.strategy,
      leads: data.leads,
      contacts: data.contacts,
      companyProfile: data.companyProfile,
    },
  }), [location.pathname, activeCompanyId, prompt, data]);

  useEffect(() => {
    if (!activeCompanyId) {
      setHistory([]);
      return;
    }

    loadPromptHistory(activeCompanyId, panelMeta.panelKey).then((items) => {
      setHistory(items);
    });
  }, [activeCompanyId, panelMeta.panelKey]);

  const canExecute = !!activeCompanyId && prompt.trim().length > 4;

  const handleExecute = async () => {
    if (!canExecute || !activeCompanyId) return;

    setLoading(true);
    try {
      const execution = await executeGlobalOrchestration({
        context: panelMeta,
        suggestOnly,
        data: {
          orders: data.orders,
          opportunities: data.opportunities,
          products: data.products,
          strategy: data.strategy,
          leads: data.leads,
          contacts: data.contacts,
          companyProfile: data.companyProfile,
        },
        mutators: {
          setOrders,
          setOpportunities,
          setProducts,
          setStrategy,
          setLeads,
          setContacts,
        },
      });

      const nextHistory = [prompt.trim(), ...history.filter((item) => item !== prompt.trim())].slice(0, 12);
      setHistory(nextHistory);
      setResult({
        confidence: execution.confidence,
        safeMode: execution.safeMode,
        summary: execution.executionSummary,
        changes: execution.changesApplied.map((change) => change.description),
        suggestions: execution.suggestions,
      });
    } finally {
      setLoading(false);
    }
  };

  const confidenceTone = result
    ? result.confidence >= 0.85
      ? 'default'
      : result.confidence >= 0.75
        ? 'secondary'
        : 'destructive'
    : 'outline';

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 rounded-full shadow-lg"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? 'Minimize prompt control box' : 'Open prompt control box'}
        >
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-20 right-4 z-40 w-[min(520px,calc(100vw-2rem))]">
          <Card className="border-primary/30 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Prompt Control Box
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
              aria-label="Minimize prompt control box"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{panelMeta.panel}</Badge>
            <Badge variant="outline">Company: {activeCompanyId ? 'Active' : 'Not selected'}</Badge>
            {result && <Badge variant={confidenceTone}>Confidence {Math.round(result.confidence * 100)}%</Badge>}
            {result?.safeMode && <Badge variant="destructive">Safe Mode</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Write what you want the GOA to do in this panel..."
            className="min-h-[92px]"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExecute} disabled={!canExecute || loading} size="sm">
              <Play className="h-3.5 w-3.5 mr-1" />
              {loading ? 'Executing...' : 'Execute'}
            </Button>
            <Button
              size="sm"
              variant={suggestOnly ? 'default' : 'outline'}
              onClick={() => setSuggestOnly((current) => !current)}
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1" />
              Suggest Improvements
            </Button>
          </div>

          {result && (
            <div className="rounded-md border p-2.5 bg-muted/25 text-xs space-y-2">
              <p className="font-medium text-foreground">{result.summary}</p>

              <div>
                <p className="font-medium mb-1">Changes applied</p>
                {result.changes.length === 0 ? (
                  <p className="text-muted-foreground">No direct changes applied.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.changes.slice(0, 6).map((change) => <li key={change}>• {change}</li>)}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Suggestions</p>
                {result.suggestions.length === 0 ? (
                  <p className="text-muted-foreground">No suggestions generated.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.suggestions.slice(0, 6).map((suggestion) => <li key={suggestion}>• {suggestion}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="rounded-md border p-2.5 bg-muted/20 text-xs">
            <div className="flex items-center gap-1 font-medium mb-1">
              <History className="h-3.5 w-3.5" /> Prompt history
            </div>
            {history.length === 0 ? (
              <p className="text-muted-foreground">No panel prompt history yet.</p>
            ) : (
              <ul className="space-y-1 max-h-24 overflow-auto pr-1">
                {history.slice(0, 8).map((item) => (
                  <li key={item} className="truncate">• {item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            GOA pipeline: interpret → context load → plan → execute → validate → apply → log.
          </div>
        </CardContent>
      </Card>
        </div>
      )}
    </>
  );
}
