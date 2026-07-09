import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://bucketlistspots.com';

export default function SEO({ title, description, path, ogImage, type }) {
  const fullTitle = title ? `${title} | BucketListSpots` : 'BucketListSpots — Verified Local Guides';
  const fullDesc = description || 'Book verified local guides for life-changing bucket list adventures around the world. Safe, fair, authentic.';
  const url = `${BASE_URL}${path || '/'}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDesc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDesc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type || 'website'} />
      <meta property="og:image" content={ogImage || `${BASE_URL}/images/og-default.jpg`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDesc} />
      <meta name="twitter:image" content={ogImage || `${BASE_URL}/images/og-default.jpg`} />
      <meta name="twitter:site" content="@bucketlistspots" />
      <link rel="canonical" href={url} />
    </Helmet>
  );
}
