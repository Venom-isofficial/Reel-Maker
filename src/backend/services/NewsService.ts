import axios from 'axios';
import { NewsArticle, ServiceResult } from '../types';

export class NewsService {
  private finnhubApiKey: string;
  private marketauxApiKey: string;
  private alphavantageApiKey: string;
  private benzingaApiKey: string;

  constructor(finnhubKey?: string, marketauxKey?: string, alphavantageKey?: string, benzingaKey?: string) {
    this.finnhubApiKey = finnhubKey || process.env.FINNHUB_API_KEY || '';
    this.marketauxApiKey = marketauxKey || process.env.MARKETAUX_API_KEY || 'HC2frmeEAmHQdKbR6xpzcfPgEc3yrkKfc2l47o2J';
    this.alphavantageApiKey = alphavantageKey || process.env.ALPHAVANTAGE_API_KEY || 'SFVEPBJN5VEQJD3E';
    this.benzingaApiKey = benzingaKey || process.env.BENZINGA_API_KEY || 'bz.DAHUHM6A22IB6N2DBYBPSGEW5342FMLW';
  }

  public setApiKey(key: string) {
    this.finnhubApiKey = key;
  }

  public setMarketauxApiKey(key: string) {
    this.marketauxApiKey = key;
  }

  public setAlphavantageApiKey(key: string) {
    this.alphavantageApiKey = key;
  }

  public setBenzingaApiKey(key: string) {
    this.benzingaApiKey = key;
  }

  public async fetchLatestFinanceArticle(source: 'finnhub' | 'marketaux' | 'alphavantage' | 'benzinga' = 'marketaux'): Promise<ServiceResult<NewsArticle>> {
    if (source === 'finnhub') {
      return this.fetchFinnhubArticle();
    } else if (source === 'alphavantage') {
      return this.fetchAlphaVantageArticle();
    } else if (source === 'benzinga') {
      return this.fetchBenzingaArticle();
    }
    return this.fetchMarketauxArticle();
  }

  public async fetchMarketauxArticle(): Promise<ServiceResult<NewsArticle>> {
    try {
      const key = this.marketauxApiKey || process.env.MARKETAUX_API_KEY || 'HC2frmeEAmHQdKbR6xpzcfPgEc3yrkKfc2l47o2J';
      if (!key) {
        return this.getMockArticle("Marketaux API Key not configured. Using trending market news.");
      }

      console.log('📈 Fetching latest finance news headline from Marketaux API...');
      const response = await axios.get(`https://api.marketaux.com/v1/news/all?api_token=${key}&language=en&limit=3`, {
        timeout: 10000,
      });

      const data = response.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        const validArticles = data.filter((a: any) => a.title && (a.description || a.snippet) && ((a.description || a.snippet).length > 20));
        const item = validArticles.length > 0 ? validArticles[Math.floor(Math.random() * validArticles.length)] : data[0];

        const summaryText = item.description || item.snippet || item.title;

        const article: NewsArticle = {
          id: String(item.uuid || Date.now()),
          headline: item.title,
          summary: summaryText,
          url: item.url || 'https://www.marketaux.com',
          source: item.source || 'Marketaux News',
          datetime: item.published_at ? Math.floor(new Date(item.published_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
          category: 'Financial Market News',
          fullText: `${item.title}. ${summaryText}`,
          rawData: item,
        };

        console.log(`✅ Marketaux News fetched: "${article.headline}" (Source: ${article.source})`);
        return { success: true, retryable: false, data: article };
      }

      return this.getMockArticle("No articles returned from Marketaux API. Fallback triggered.");
    } catch (err: any) {
      console.warn("Marketaux API fetch error, utilizing fallback article:", err.message);
      return this.getMockArticle(`Marketaux request failed: ${err.message}`);
    }
  }

  public async fetchAlphaVantageArticle(): Promise<ServiceResult<NewsArticle>> {
    try {
      const key = this.alphavantageApiKey || process.env.ALPHAVANTAGE_API_KEY || 'SFVEPBJN5VEQJD3E';
      if (!key) {
        return this.getMockArticle("Alpha Vantage API Key not configured. Using trending market news.");
      }

      console.log('⚡ Fetching latest finance news from Alpha Vantage API...');
      const response = await axios.get(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=10&apikey=${key}`, {
        timeout: 12000,
      });

      const feed = response.data?.feed;
      if (Array.isArray(feed) && feed.length > 0) {
        const validArticles = feed.filter((a: any) => a.title && a.summary && a.summary.length > 20);
        const item = validArticles.length > 0 ? validArticles[Math.floor(Math.random() * validArticles.length)] : feed[0];

        const article: NewsArticle = {
          id: String(item.url || Date.now()),
          headline: item.title,
          summary: item.summary,
          url: item.url || 'https://www.alphavantage.co',
          source: item.source || 'Alpha Vantage News',
          datetime: Math.floor(Date.now() / 1000),
          category: item.category_within_source || 'Market News',
          fullText: `${item.title}. ${item.summary}`,
          rawData: item,
        };

        console.log(`✅ Alpha Vantage News fetched: "${article.headline}" (Source: ${article.source})`);
        return { success: true, retryable: false, data: article };
      }

      return this.getMockArticle("No articles returned from Alpha Vantage API. Fallback triggered.");
    } catch (err: any) {
      console.warn("Alpha Vantage API fetch error, utilizing fallback article:", err.message);
      return this.getMockArticle(`Alpha Vantage request failed: ${err.message}`);
    }
  }

  public async fetchBenzingaArticle(): Promise<ServiceResult<NewsArticle>> {
    try {
      const key = this.benzingaApiKey || process.env.BENZINGA_API_KEY || 'bz.DAHUHM6A22IB6N2DBYBPSGEW5342FMLW';
      if (!key) {
        return this.getMockArticle("Benzinga API Key not configured. Using trending market news.");
      }

      console.log('📰 Fetching latest stock news from Benzinga API...');
      const response = await axios.get(`https://api.benzinga.com/api/v2/news?token=${key}&pageSize=10`, {
        timeout: 10000,
        headers: { 'Accept': 'application/json' },
      });

      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        const validArticles = data.filter((a: any) => a.title && (a.teaser || a.body || a.title));
        const item = validArticles.length > 0 ? validArticles[Math.floor(Math.random() * validArticles.length)] : data[0];

        const summaryText = item.teaser ? item.teaser.replace(/<[^>]*>?/gm, '') : item.title;

        const article: NewsArticle = {
          id: String(item.id || Date.now()),
          headline: item.title,
          summary: summaryText,
          url: item.url || 'https://www.benzinga.com',
          source: item.author || item.source || 'Benzinga Market News',
          datetime: item.created ? Math.floor(new Date(item.created).getTime() / 1000) : Math.floor(Date.now() / 1000),
          category: 'Stock Market News',
          fullText: `${item.title}. ${summaryText}`,
          rawData: item,
        };

        console.log(`✅ Benzinga News fetched: "${article.headline}" (Source: ${article.source})`);
        return { success: true, retryable: false, data: article };
      }

      return this.getMockArticle("No articles returned from Benzinga API. Fallback triggered.");
    } catch (err: any) {
      console.warn("Benzinga API fetch error, utilizing fallback article:", err.message);
      return this.getMockArticle(`Benzinga request failed: ${err.message}`);
    }
  }

  public async fetchFinnhubArticle(): Promise<ServiceResult<NewsArticle>> {
    try {
      if (!this.finnhubApiKey) {
        return this.getMockArticle("Finnhub API Key not configured. Using trending market news.");
      }

      console.log('📰 Fetching latest finance news headline from Finnhub API...');
      const response = await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${this.finnhubApiKey}`, {
        timeout: 10000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const validArticles = response.data.filter((a: any) => a.headline && a.summary && a.summary.length > 20);
        const item = validArticles.length > 0 ? validArticles[Math.floor(Math.random() * validArticles.length)] : response.data[0];
        
        const article: NewsArticle = {
          id: String(item.id || Date.now()),
          headline: item.headline,
          summary: item.summary,
          url: item.url || 'https://finnhub.io',
          source: item.source || 'Finnhub',
          datetime: item.datetime || Math.floor(Date.now() / 1000),
          category: item.category || 'general',
          fullText: `${item.headline}. ${item.summary}`,
          rawData: item,
        };

        return { success: true, retryable: false, data: article };
      }

      return this.getMockArticle("No articles returned from Finnhub API. Fallback triggered.");
    } catch (err: any) {
      console.warn("Finnhub API fetch error, utilizing fallback article:", err.message);
      return this.getMockArticle(`Finnhub request failed: ${err.message}`);
    }
  }

  private getMockArticle(reason: string): ServiceResult<NewsArticle> {
    const mockArticles: NewsArticle[] = [
      {
        id: 'mock_01',
        headline: 'Federal Reserve Signals Interest Rate Decisions as Tech Stocks Rally',
        summary: 'Major tech indices surged today as investors reacted to inflation data and central bank commentary regarding interest rate trajectories.',
        url: 'https://finance.example.com/fed-tech-rally',
        source: 'Global Financial Network',
        datetime: Math.floor(Date.now() / 1000),
        category: 'Market News',
        fullText: 'Major tech indices surged today as investors reacted to inflation data and central bank commentary regarding interest rate trajectories. Semiconductor makers led gains with an average surge of 4.2% after quarterly guidance exceeded expectations.'
      },
      {
        id: 'mock_02',
        headline: 'Artificial Intelligence Chip Demand Reaches Record High in Q3',
        summary: 'Global semiconductor suppliers report unprecedented demand for next-generation AI accelerators driving record revenue growth across tech sector.',
        url: 'https://finance.example.com/ai-chip-demand',
        source: 'Tech Market Insider',
        datetime: Math.floor(Date.now() / 1000),
        category: 'Technology',
        fullText: 'Global semiconductor suppliers report unprecedented demand for next-generation AI accelerators driving record revenue growth across tech sector. Analysts forecast sustained capital expenditure throughout the upcoming fiscal year.'
      }
    ];

    const chosen = mockArticles[Math.floor(Math.random() * mockArticles.length)];
    return {
      success: true,
      retryable: false,
      data: chosen,
      errorMessage: reason,
    };
  }
}
