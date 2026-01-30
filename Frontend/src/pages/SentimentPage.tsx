
import { useSearchParams } from 'react-router-dom';
import SentimentContainer from '../components/SentimentContainer';

const SentimentPage = () => {
  const [searchParams] = useSearchParams();
  const ticker = searchParams.get('ticker')?.toUpperCase() || null;

  return <SentimentContainer ticker={ticker} />;
};

export default SentimentPage;

