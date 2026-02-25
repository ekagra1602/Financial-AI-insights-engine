import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SentimentContainer from '../components/SentimentContainer';

const SentimentPage = () => {
  const [searchParams] = useSearchParams();
  const [ticker, setTicker] = useState<string | null>(null);

  useEffect(() => {
    const tickerParam = searchParams.get('ticker');
    if (tickerParam) {
      setTicker(tickerParam.toUpperCase());
    }
  }, [searchParams]);

  return <SentimentContainer ticker={ticker} />;
};

export default SentimentPage;

