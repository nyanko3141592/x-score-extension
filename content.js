// X Score - Tweet Engagement Analyzer
// Based on X's official algorithm weights
// Sources: https://github.com/xai-org/x-algorithm, https://github.com/twitter/the-algorithm

(function() {
  'use strict';

  // Official X Algorithm weights (from open-source documentation)
  // These weights are applied to P(action) - probability of user taking action
  const WEIGHTS = {
    // Positive signals
    replyWithEngagement: 75.0,   // Reply that gets engagement from author
    reply: 13.5,                  // Direct reply
    profileClickEngagement: 12.0, // Profile click + like/reply
    conversationEngagement: 11.0, // Click into conversation and engage
    dwell: 10.0,                  // Stay in conversation 2+ minutes
    repost: 1.0,                  // Retweet
    favorite: 0.5,                // Like
    videoView: 0.005,             // Watch 50%+ of video

    // Negative signals (penalties)
    notInterested: -74.0,         // "Not interested" / mute / block
    report: -369.0                // Report tweet
  };

  // Premium boost multipliers
  const PREMIUM_BOOST = {
    inNetwork: 4.0,   // Blue verified in-network
    outNetwork: 2.0   // Blue verified out-of-network
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
      bookmarks: 0,
      hasMedia: false,
      hasVideo: false,
      hasLink: false,
      isVerified: false,
      isThread: false
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
    const bookmarkButton = tweetElement.querySelector('[data-testid="bookmark"]');

    // Try multiple selectors for view count
    const viewsElement = tweetElement.querySelector('a[href*="/analytics"]') ||
                         tweetElement.querySelector('[data-testid="app-text-transition-container"]');

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

    if (bookmarkButton) {
      const bookmarkCount = bookmarkButton.querySelector('[dir="ltr"]');
      data.bookmarks = parseEngagementNumber(bookmarkCount?.textContent);
    }

    if (viewsElement) {
      data.views = parseEngagementNumber(viewsElement.textContent);
    }

    // Check for media
    data.hasMedia = !!tweetElement.querySelector('[data-testid="tweetPhoto"]');
    data.hasVideo = !!tweetElement.querySelector('[data-testid="videoPlayer"]') ||
                    !!tweetElement.querySelector('[data-testid="videoComponent"]');
    data.hasLink = !!tweetElement.querySelector('[data-testid="card.wrapper"]');

    // Check for verified badge
    data.isVerified = !!tweetElement.querySelector('[data-testid="icon-verified"]') ||
                      !!tweetElement.querySelector('svg[aria-label*="認証"]') ||
                      !!tweetElement.querySelector('svg[aria-label*="Verified"]');

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
      lineBreaks: (text.match(/\n/g) || []).length
    };
  }

  // Calculate algorithm score based on official weights
  function calculateScore(tweetData) {
    const textFeatures = analyzeText(tweetData.text);

    // Calculate engagement rate
    let engagementRate = 0;
    if (tweetData.views > 0) {
      engagementRate = (tweetData.likes + tweetData.replies + tweetData.reposts) / tweetData.views;
    }

    // Estimate probabilities from actual engagement (normalized by views or baseline)
    const baseline = Math.max(tweetData.views, 1000); // Assume minimum 1000 impressions

    // P(action) estimates based on actual engagement
    const probabilities = {
      favorite: Math.min(tweetData.likes / baseline, 1),
      reply: Math.min(tweetData.replies / baseline, 1),
      repost: Math.min(tweetData.reposts / baseline, 1),
      // Estimate reply-with-engagement as portion of replies that generate conversation
      replyWithEngagement: Math.min((tweetData.replies * 0.1) / baseline, 1),
      // Estimate conversation engagement
      conversationEngagement: Math.min((tweetData.replies * 0.05) / baseline, 1),
      // Estimate dwell time based on text length and engagement
      dwell: Math.min((textFeatures.length / 280) * (engagementRate * 10), 1),
      // Video view estimate
      videoView: tweetData.hasVideo ? Math.min(tweetData.views * 0.3 / baseline, 1) : 0,
      // Profile click estimate
      profileClickEngagement: Math.min((tweetData.likes * 0.02) / baseline, 1)
    };

    // Calculate weighted score using official formula: Σ (weight × P(action))
    let score = 0;
    const breakdown = {};

    // Positive contributions
    breakdown.replyWithEngagement = {
      probability: probabilities.replyWithEngagement,
      weight: WEIGHTS.replyWithEngagement,
      contribution: probabilities.replyWithEngagement * WEIGHTS.replyWithEngagement
    };

    breakdown.reply = {
      probability: probabilities.reply,
      weight: WEIGHTS.reply,
      contribution: probabilities.reply * WEIGHTS.reply
    };

    breakdown.profileClickEngagement = {
      probability: probabilities.profileClickEngagement,
      weight: WEIGHTS.profileClickEngagement,
      contribution: probabilities.profileClickEngagement * WEIGHTS.profileClickEngagement
    };

    breakdown.conversationEngagement = {
      probability: probabilities.conversationEngagement,
      weight: WEIGHTS.conversationEngagement,
      contribution: probabilities.conversationEngagement * WEIGHTS.conversationEngagement
    };

    breakdown.dwell = {
      probability: probabilities.dwell,
      weight: WEIGHTS.dwell,
      contribution: probabilities.dwell * WEIGHTS.dwell
    };

    breakdown.repost = {
      probability: probabilities.repost,
      weight: WEIGHTS.repost,
      contribution: probabilities.repost * WEIGHTS.repost
    };

    breakdown.favorite = {
      probability: probabilities.favorite,
      weight: WEIGHTS.favorite,
      contribution: probabilities.favorite * WEIGHTS.favorite
    };

    breakdown.videoView = {
      probability: probabilities.videoView,
      weight: WEIGHTS.videoView,
      contribution: probabilities.videoView * WEIGHTS.videoView
    };

    // Sum all contributions
    for (const action in breakdown) {
      score += breakdown[action].contribution;
    }

    // Apply verified boost if applicable
    let verifiedBoost = 1.0;
    if (tweetData.isVerified) {
      verifiedBoost = PREMIUM_BOOST.outNetwork; // Assume out-of-network by default
    }

    const finalScore = score * verifiedBoost;

    return {
      total: Math.round(finalScore * 100) / 100,
      rawScore: Math.round(score * 100) / 100,
      breakdown: breakdown,
      engagement: {
        likes: tweetData.likes,
        replies: tweetData.replies,
        reposts: tweetData.reposts,
        views: tweetData.views,
        bookmarks: tweetData.bookmarks,
        rate: engagementRate
      },
      textFeatures: textFeatures,
      hasMedia: tweetData.hasMedia,
      hasVideo: tweetData.hasVideo,
      isVerified: tweetData.isVerified,
      verifiedBoost: verifiedBoost
    };
  }

  // Get score color class
  function getScoreClass(score) {
    if (score >= 5) return 'score-very-high';
    if (score >= 2) return 'score-high';
    if (score >= 0.5) return 'score-medium';
    return 'score-low';
  }

  // Create score badge
  function createScoreBadge(scoreData) {
    const badge = document.createElement('div');
    badge.className = `x-score-badge ${getScoreClass(scoreData.total)}`;
    badge.innerHTML = `
      <span class="x-score-badge-icon">X</span>
      <span class="x-score-badge-value">${scoreData.total.toFixed(2)}</span>
    `;

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showScorePopup(badge, scoreData, e);
    });

    return badge;
  }

  // Show detailed popup
  function showScorePopup(badge, scoreData, event) {
    // Remove existing popup
    const existingPopup = document.querySelector('.x-score-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'x-score-popup';

    const engRate = scoreData.engagement.rate > 0
      ? (scoreData.engagement.rate * 100).toFixed(3) + '%'
      : 'N/A';

    // Sort breakdown by contribution
    const sortedBreakdown = Object.entries(scoreData.breakdown)
      .filter(([_, data]) => data.contribution > 0)
      .sort((a, b) => b[1].contribution - a[1].contribution);

    const actionLabels = {
      replyWithEngagement: 'リプライ→会話 (x75)',
      reply: 'リプライ (x13.5)',
      profileClickEngagement: 'プロフィール (x12)',
      conversationEngagement: '会話参加 (x11)',
      dwell: '滞在時間 (x10)',
      repost: 'リポスト (x1)',
      favorite: 'いいね (x0.5)',
      videoView: '動画視聴 (x0.005)'
    };

    const breakdownHtml = sortedBreakdown.map(([action, data]) => `
      <div class="x-score-breakdown-item">
        <span class="x-score-breakdown-label">${actionLabels[action] || action}</span>
        <div class="x-score-breakdown-bar-container">
          <div class="x-score-breakdown-bar" style="width: ${Math.min(100, data.contribution * 20)}%"></div>
        </div>
        <span class="x-score-breakdown-value">+${data.contribution.toFixed(3)}</span>
      </div>
    `).join('');

    popup.innerHTML = `
      <div class="x-score-popup-header">
        <span class="x-score-popup-title">Algorithm Score</span>
        <span class="x-score-popup-score ${getScoreClass(scoreData.total)}">${scoreData.total.toFixed(2)}</span>
      </div>

      ${scoreData.isVerified ? `
      <div class="x-score-verified-badge">
        Premium認証済み (x${scoreData.verifiedBoost} boost)
      </div>
      ` : ''}

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Engagement Metrics</div>
        <div class="x-score-popup-grid">
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">いいね</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.likes)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">リプライ</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.replies)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">リポスト</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.reposts)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">表示回数</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.views)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">ブックマーク</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.bookmarks)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">エンゲージ率</span>
            <span class="x-score-popup-value">${engRate}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Score Breakdown (Official Weights)</div>
        <div class="x-score-breakdown-list">
          ${breakdownHtml}
        </div>
        <div class="x-score-formula">
          Score = Σ (weight × P(action))
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">Content</div>
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
            <span class="x-score-popup-label">メディア</span>
            <span class="x-score-popup-value">${scoreData.hasVideo ? '動画' : scoreData.hasMedia ? '画像' : 'なし'}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-footer">
        Based on X Algorithm (xai-org/x-algorithm)
      </div>
    `;

    // Position popup
    const rect = badge.getBoundingClientRect();
    const isUpperHalf = rect.top < window.innerHeight / 2;

    popup.style.position = 'fixed';
    popup.style.zIndex = '10000';

    if (isUpperHalf && event) {
      // If in upper half, position relative to mouse cursor with offset
      popup.style.left = `${event.clientX + 20}px`;
      popup.style.top = `${event.clientY}px`;
    } else {
      // Default position below the badge
      popup.style.top = `${rect.bottom + 8}px`;
      popup.style.left = `${rect.left}px`;
    }

    document.body.appendChild(popup);

    // Adjust position if off-screen
    let popupRect = popup.getBoundingClientRect();

    // Ensure top is within viewport
    if (popupRect.top < 0) {
      popup.style.top = '8px';
    }

    // Ensure right is within viewport
    if (popupRect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - popupRect.width - 16}px`;
    }

    // Ensure bottom is within viewport
    popupRect = popup.getBoundingClientRect(); // Re-measure after top/left adjustments
    if (popupRect.bottom > window.innerHeight) {
      if (isUpperHalf) {
        // If it's still too long, just keep it at the top and let it be cut at bottom or handle scroll
        popup.style.top = `${window.innerHeight - popupRect.height - 8}px`;
        // Re-check top again
        if (parseFloat(popup.style.top) < 0) popup.style.top = '8px';
      } else {
        // Position above the badge
        popup.style.top = `${rect.top - popupRect.height - 8}px`;
        // Re-check top again
        if (parseFloat(popup.style.top) < 0) popup.style.top = '8px';
      }
    }

    // Close on click outside
    const closePopup = (e) => {
      if (!popup.contains(e.target) && e.target !== badge) {
        popup.remove();
        document.removeEventListener('click', closePopup);
        window.removeEventListener('scroll', closeOnScroll);
      }
    };

    // Close on scroll
    const closeOnScroll = () => {
      popup.remove();
      document.removeEventListener('click', closePopup);
      window.removeEventListener('scroll', closeOnScroll);
    };

    setTimeout(() => {
      document.addEventListener('click', closePopup);
      window.addEventListener('scroll', closeOnScroll, { passive: true });
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

    // Skip tweets with no content
    if (!tweetData.text && !tweetData.hasMedia && !tweetData.hasVideo) return;

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
