// X Score - Tweet Engagement Analyzer
// Based on X's For You algorithm (xai-org/x-algorithm)

(function() {
  'use strict';

  // Engagement weights based on X algorithm structure
  const WEIGHTS = {
    favorite: 1.0,
    reply: 11.0,
    repost: 20.0,
    quote: 30.0,
    click: 0.5,
    profileClick: 2.0,
    videoView: 0.1,
    photoExpand: 0.5,
    share: 10.0,
    dwell: 0.5,
    followAuthor: 50.0,
    notInterested: -100.0,
    blockAuthor: -500.0,
    muteAuthor: -300.0,
    report: -1000.0
  };

  const processedTweets = new WeakSet();

  // Parse engagement numbers (e.g., "1.2K" -> 1200)
  function parseEngagementNumber(text) {
    if (!text) return 0;
    text = text.trim().replace(/,/g, '');
    if (text.endsWith('K') || text.endsWith('k')) {
      return parseFloat(text) * 1000;
    }
    if (text.endsWith('M') || text.endsWith('m')) {
      return parseFloat(text) * 1000000;
    }
    return parseInt(text) || 0;
  }

  // Extract tweet data from DOM
  function extractTweetData(tweetElement) {
    const data = {
      text: '',
      likes: 0,
      replies: 0,
      reposts: 0,
      views: 0,
      hasMedia: false,
      hasVideo: false,
      hasLink: false,
      isThread: false,
      authorFollowers: 0
    };

    // Get tweet text
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    if (textElement) {
      data.text = textElement.textContent || '';
    }

    // Get engagement metrics
    const replyButton = tweetElement.querySelector('[data-testid="reply"]');
    const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
    const likeButton = tweetElement.querySelector('[data-testid="like"]');
    const viewsElement = tweetElement.querySelector('a[href*="/analytics"]');

    if (replyButton) {
      const replyCount = replyButton.querySelector('[dir="ltr"]');
      data.replies = parseEngagementNumber(replyCount?.textContent);
    }

    if (retweetButton) {
      const retweetCount = retweetButton.querySelector('[dir="ltr"]');
      data.reposts = parseEngagementNumber(retweetCount?.textContent);
    }

    if (likeButton) {
      const likeCount = likeButton.querySelector('[dir="ltr"]');
      data.likes = parseEngagementNumber(likeCount?.textContent);
    }

    if (viewsElement) {
      data.views = parseEngagementNumber(viewsElement.textContent);
    }

    // Check for media
    data.hasMedia = !!tweetElement.querySelector('[data-testid="tweetPhoto"]');
    data.hasVideo = !!tweetElement.querySelector('[data-testid="videoPlayer"]');
    data.hasLink = !!tweetElement.querySelector('[data-testid="card.wrapper"]');

    return data;
  }

  // Analyze text features
  function analyzeText(text) {
    return {
      length: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      hashtags: (text.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g) || []).length,
      mentions: (text.match(/@\w+/g) || []).length,
      urls: (text.match(/https?:\/\/\S+/g) || []).length,
      emojis: (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length,
      hasQuestion: text.includes('?') || text.includes('？'),
      hasExclamation: text.includes('!') || text.includes('！'),
      lineBreaks: (text.match(/\n/g) || []).length,
      sentiment: analyzeSentiment(text)
    };
  }

  // Simple sentiment analysis
  function analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'best', 'amazing', 'happy', 'excellent', 'beautiful', 'wonderful', 'fantastic', 'brilliant',
      'すごい', '嬉しい', '楽しい', '最高', '素晴らしい', 'ありがとう', '感謝', '好き', '大好き', '面白い', '笑', 'www', '草'];
    const negativeWords = ['bad', 'hate', 'worst', 'terrible', 'awful', 'horrible', 'sad', 'angry', 'poor', 'disappointing',
      '嫌い', '最悪', 'つらい', '悲しい', '怒り', 'ひどい', '残念'];

    const lowerText = text.toLowerCase();
    let score = 0;

    for (const word of positiveWords) {
      if (lowerText.includes(word)) score += 0.1;
    }
    for (const word of negativeWords) {
      if (lowerText.includes(word)) score -= 0.1;
    }

    return Math.max(-1, Math.min(1, score));
  }

  // Calculate algorithm score
  function calculateScore(tweetData) {
    const textFeatures = analyzeText(tweetData.text);

    // Calculate engagement rate if views are available
    let engagementRate = 0;
    if (tweetData.views > 0) {
      engagementRate = (tweetData.likes + tweetData.replies * 2 + tweetData.reposts * 3) / tweetData.views;
    }

    // Base score from actual engagement (normalized)
    let score = 0;

    // Contribution from likes (weight: 1.0)
    score += Math.log10(tweetData.likes + 1) * WEIGHTS.favorite;

    // Contribution from replies (weight: 11.0)
    score += Math.log10(tweetData.replies + 1) * WEIGHTS.reply;

    // Contribution from reposts (weight: 20.0)
    score += Math.log10(tweetData.reposts + 1) * WEIGHTS.repost;

    // Content quality multipliers
    let multiplier = 1.0;

    // Length factor
    if (textFeatures.length > 50 && textFeatures.length < 200) {
      multiplier *= 1.2;
    } else if (textFeatures.length > 280) {
      multiplier *= 0.9;
    }

    // Question tweets get more replies
    if (textFeatures.hasQuestion) {
      multiplier *= 1.15;
    }

    // Hashtags (1-2 is optimal)
    if (textFeatures.hashtags >= 1 && textFeatures.hashtags <= 2) {
      multiplier *= 1.1;
    } else if (textFeatures.hashtags > 4) {
      multiplier *= 0.8;
    }

    // Media bonus
    if (tweetData.hasMedia) {
      multiplier *= 1.3;
    }
    if (tweetData.hasVideo) {
      multiplier *= 1.5;
    }

    // Positive sentiment bonus
    if (textFeatures.sentiment > 0) {
      multiplier *= 1 + textFeatures.sentiment * 0.2;
    }

    // Apply engagement rate bonus
    if (engagementRate > 0.05) {
      multiplier *= 1.5;
    } else if (engagementRate > 0.02) {
      multiplier *= 1.2;
    }

    score *= multiplier;

    return {
      total: Math.round(score * 10) / 10,
      engagement: {
        likes: tweetData.likes,
        replies: tweetData.replies,
        reposts: tweetData.reposts,
        views: tweetData.views,
        rate: engagementRate
      },
      textFeatures: textFeatures,
      multiplier: multiplier,
      hasMedia: tweetData.hasMedia,
      hasVideo: tweetData.hasVideo
    };
  }

  // Get score color class
  function getScoreClass(score) {
    if (score >= 50) return 'score-very-high';
    if (score >= 20) return 'score-high';
    if (score >= 10) return 'score-medium';
    return 'score-low';
  }

  // Create score badge
  function createScoreBadge(scoreData) {
    const badge = document.createElement('div');
    badge.className = `x-score-badge ${getScoreClass(scoreData.total)}`;
    badge.innerHTML = `
      <span class="x-score-badge-icon">X</span>
      <span class="x-score-badge-value">${scoreData.total}</span>
    `;

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showScorePopup(badge, scoreData);
    });

    return badge;
  }

  // Show detailed popup
  function showScorePopup(badge, scoreData) {
    // Remove existing popup
    const existingPopup = document.querySelector('.x-score-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'x-score-popup';

    const engRate = scoreData.engagement.rate > 0
      ? (scoreData.engagement.rate * 100).toFixed(2) + '%'
      : 'N/A';

    popup.innerHTML = `
      <div class="x-score-popup-header">
        <span class="x-score-popup-title">Algorithm Score</span>
        <span class="x-score-popup-score ${getScoreClass(scoreData.total)}">${scoreData.total}</span>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Engagement</div>
        <div class="x-score-popup-grid">
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">いいね</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.likes)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">返信</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.replies)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">リポスト</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.reposts)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">表示</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.views)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">エンゲージ率</span>
            <span class="x-score-popup-value">${engRate}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Content Analysis</div>
        <div class="x-score-popup-grid">
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">文字数</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.length}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">ハッシュタグ</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.hashtags}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">メンション</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.mentions}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">絵文字</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.emojis}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">メディア</span>
            <span class="x-score-popup-value">${scoreData.hasVideo ? '動画' : scoreData.hasMedia ? '画像' : 'なし'}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">ブースト</span>
            <span class="x-score-popup-value">x${scoreData.multiplier.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Score Breakdown</div>
        <div class="x-score-popup-breakdown">
          <div class="x-score-breakdown-item">
            <span>いいね寄与</span>
            <span>+${(Math.log10(scoreData.engagement.likes + 1) * WEIGHTS.favorite).toFixed(1)}</span>
          </div>
          <div class="x-score-breakdown-item">
            <span>返信寄与 (x11)</span>
            <span>+${(Math.log10(scoreData.engagement.replies + 1) * WEIGHTS.reply).toFixed(1)}</span>
          </div>
          <div class="x-score-breakdown-item">
            <span>リポスト寄与 (x20)</span>
            <span>+${(Math.log10(scoreData.engagement.reposts + 1) * WEIGHTS.repost).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-footer">
        Based on X Algorithm weights
      </div>
    `;

    // Position popup
    const rect = badge.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = `${rect.bottom + 8}px`;
    popup.style.left = `${rect.left}px`;
    popup.style.zIndex = '10000';

    document.body.appendChild(popup);

    // Adjust position if off-screen
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - popupRect.width - 16}px`;
    }
    if (popupRect.bottom > window.innerHeight) {
      popup.style.top = `${rect.top - popupRect.height - 8}px`;
    }

    // Close on click outside
    const closePopup = (e) => {
      if (!popup.contains(e.target) && e.target !== badge) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closePopup);
    }, 0);
  }

  // Format large numbers
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Process a single tweet
  function processTweet(tweetElement) {
    if (processedTweets.has(tweetElement)) return;
    processedTweets.add(tweetElement);

    const tweetData = extractTweetData(tweetElement);

    // Skip tweets with no text
    if (!tweetData.text && !tweetData.hasMedia) return;

    const scoreData = calculateScore(tweetData);
    const badge = createScoreBadge(scoreData);

    // Find a good place to insert the badge
    const actionBar = tweetElement.querySelector('[role="group"]');
    if (actionBar) {
      actionBar.style.position = 'relative';
      badge.style.marginLeft = '12px';
      actionBar.appendChild(badge);
    }
  }

  // Find and process all tweets
  function processAllTweets() {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    tweets.forEach(processTweet);
  }

  // Initialize
  function init() {
    // Process existing tweets
    processAllTweets();

    // Observe for new tweets
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }
      if (shouldProcess) {
        requestAnimationFrame(processAllTweets);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also process on scroll (for virtual scrolling)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processAllTweets, 200);
    }, { passive: true });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
