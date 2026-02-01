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

  function extractNumberFromLabel(label) {
    if (!label) return 0;
    const match = label.match(/([0-9][0-9,\.\s]*[KkMmGg億万千]?)/);
    if (!match) return 0;
    return parseEngagementNumber(match[1]);
  }

  function extractCountFromButton(buttonElement) {
    if (!buttonElement) return 0;
    const countElement = buttonElement.querySelector('[dir="ltr"]');
    if (countElement && countElement.textContent) {
      return parseEngagementNumber(countElement.textContent);
    }
    return extractNumberFromLabel(buttonElement.getAttribute('aria-label'));
  }

  function extractViewCount(tweetElement) {
    const analyticsLink = tweetElement.querySelector('a[href*="/analytics"]');
    if (analyticsLink) {
      const analyticsCount = extractNumberFromLabel(
        analyticsLink.textContent || analyticsLink.getAttribute('aria-label')
      );
      if (analyticsCount > 0) return analyticsCount;
      const analyticsInner = analyticsLink.querySelector('[dir="ltr"]');
      if (analyticsInner) {
        return extractNumberFromLabel(analyticsInner.textContent);
      }
    }

    const viewCountElement = tweetElement.querySelector('[data-testid="viewCount"]');
    if (viewCountElement) {
      const viewCount = extractNumberFromLabel(
        viewCountElement.textContent || viewCountElement.getAttribute('aria-label')
      );
      if (viewCount > 0) return viewCount;
      const viewInner = viewCountElement.querySelector('[dir="ltr"]');
      if (viewInner) return extractNumberFromLabel(viewInner.textContent);
    }

    const viewLabel = tweetElement.querySelector('[aria-label*="Views"], [aria-label*="表示回数"], [aria-label*="表示"]');
    if (viewLabel) {
      const labelCount = extractNumberFromLabel(
        viewLabel.getAttribute('aria-label') || viewLabel.textContent
      );
      if (labelCount > 0) return labelCount;
    }

    // Detail view: parse view count from action group aria-label
    let scope = tweetElement;
    for (let i = 0; i < 6 && scope; i++) {
      const actionGroup = scope.querySelector('[role="group"][aria-label*="件の表示"], [role="group"][aria-label*="Views"]');
      if (actionGroup) {
        const ariaLabel = actionGroup.getAttribute('aria-label') || '';
        const viewMatch = ariaLabel.match(/([0-9,\.]+)\s*(?:件の表示|Views)/);
        if (viewMatch) {
          return parseEngagementNumber(viewMatch[1]);
        }
      }
      scope = scope.parentElement;
    }

    // Detail view fallback: "件の表示" label with adjacent count
    const spans = tweetElement.querySelectorAll('span');
    for (const span of spans) {
      const text = (span.textContent || '').trim();
      if (text !== '件の表示' && text.toLowerCase() !== 'views') continue;

      let container = span.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const transitionEl = container.querySelector('[data-testid="app-text-transition-container"]');
        if (transitionEl) {
          const count = extractNumberFromLabel(transitionEl.textContent);
          if (count > 0) return count;
        }

        const prev = container.previousElementSibling;
        if (prev) {
          const prevTransition = prev?.querySelector?.('[data-testid="app-text-transition-container"]') || null;
          if (prevTransition) {
            const count = extractNumberFromLabel(prevTransition.textContent);
            if (count > 0) return count;
          }
          const prevCount = extractNumberFromLabel(prev.textContent);
          if (prevCount > 0) return prevCount;
        }

        container = container.parentElement;
      }
    }

    // Detail view fallback: transition container near "件の表示"
    const transitionContainers = tweetElement.querySelectorAll('[data-testid="app-text-transition-container"]');
    for (const container of transitionContainers) {
      const parentText = (container.parentElement?.textContent || '').trim();
      if (parentText.includes('件の表示') || parentText.toLowerCase().includes('views')) {
        const count = extractNumberFromLabel(container.textContent);
        if (count > 0) return count;
      }
    }

    return 0;
  }

  function getTweetId(tweetElement) {
    const statusLink = tweetElement.querySelector('a[href*="/status/"]');
    const href = statusLink?.getAttribute('href') || '';
    const match = href.match(/\/status\/(\d+)/);
    return match ? match[1] : '';
  }

  // Parse engagement numbers (e.g., "1.2K" -> 1200)
  function parseEngagementNumber(text) {
    if (text === null || text === undefined) return 0;
    // Remove commas, control characters, and invisible characters
    const normalized = String(text).trim()
      .replace(/,/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

    let value = 0;
    let handled = false;

    const japaneseUnits = [
      ['億', 100000000],
      ['万', 10000],
      ['千', 1000]
    ];

    for (const [unit, multiplier] of japaneseUnits) {
      if (normalized.includes(unit)) {
        value = parseFloat(normalized.replace(new RegExp(unit, 'g'), '')) * multiplier;
        handled = true;
        break;
      }
    }

    if (!handled) {
      // Latin units (K/k, M/m, G/g)
      const unitMatch = normalized.match(/^([0-9]+\.?[0-9]*)([KkMmGg])$/);
      if (unitMatch) {
        const val = parseFloat(unitMatch[1]);
        const unit = unitMatch[2].toLowerCase();
        if (Number.isFinite(val)) {
          if (unit === 'k') value = val * 1000;
          if (unit === 'm') value = val * 1000000;
          if (unit === 'g') value = val * 1000000000;
          handled = true;
        }
      }
    }

    if (!handled) {
      const numeric = parseFloat(normalized);
      value = Number.isFinite(numeric) ? numeric : 0;
    }

    return Math.round(value);
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
    const retweetButton = tweetElement.querySelector('[data-testid="retweet"], [data-testid="unretweet"], [data-testid="repost"]');
    const likeButton = tweetElement.querySelector('[data-testid="like"], [data-testid="unlike"]');
    const bookmarkButton = tweetElement.querySelector('[data-testid="bookmark"]');

    data.replies = extractCountFromButton(replyButton);
    data.reposts = extractCountFromButton(retweetButton);
    data.likes = extractCountFromButton(likeButton);
    data.bookmarks = extractCountFromButton(bookmarkButton);
    data.views = extractViewCount(tweetElement);

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
      replyWithEngagement: chrome.i18n.getMessage('replyWithEngagement'),
      reply: chrome.i18n.getMessage('reply'),
      profileClickEngagement: chrome.i18n.getMessage('profileClickEngagement'),
      conversationEngagement: chrome.i18n.getMessage('conversationEngagement'),
      dwell: chrome.i18n.getMessage('dwellTime'),
      repost: chrome.i18n.getMessage('repost'),
      favorite: chrome.i18n.getMessage('favorite'),
      videoView: chrome.i18n.getMessage('videoView')
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

    const mediaType = scoreData.hasVideo
      ? chrome.i18n.getMessage('mediaVideo')
      : scoreData.hasMedia
        ? chrome.i18n.getMessage('mediaImage')
        : chrome.i18n.getMessage('mediaNone');

    popup.innerHTML = `
      <div class="x-score-popup-header">
        <span class="x-score-popup-title">${chrome.i18n.getMessage('algorithmScore')}</span>
        <span class="x-score-popup-score ${getScoreClass(scoreData.total)}">${scoreData.total.toFixed(2)}</span>
      </div>

      ${scoreData.isVerified ? `
      <div class="x-score-verified-badge">
        ${chrome.i18n.getMessage('premiumVerified', [scoreData.verifiedBoost.toString()])}
      </div>
      ` : ''}

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">${chrome.i18n.getMessage('engagementMetrics')}</div>
        <div class="x-score-popup-grid">
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('likes')}</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.likes)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('replies')}</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.replies)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('reposts')}</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.reposts)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('views')}</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.views)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('bookmarks')}</span>
            <span class="x-score-popup-value">${formatNumber(scoreData.engagement.bookmarks)}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('engagementRate')}</span>
            <span class="x-score-popup-value">${engRate}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">${chrome.i18n.getMessage('scoreBreakdown')}</div>
        <div class="x-score-breakdown-list">
          ${breakdownHtml}
        </div>
        <div class="x-score-formula">
          Score = Σ (weight × P(action))
        </div>
      </div>

      <div class="x-score-popup-section">
        <div class="x-score-popup-section-title">${chrome.i18n.getMessage('content')}</div>
        <div class="x-score-popup-grid">
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('characterCount')}</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.length}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('hashtags')}</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.hashtags}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('mentions')}</span>
            <span class="x-score-popup-value">${scoreData.textFeatures.mentions}</span>
          </div>
          <div class="x-score-popup-item">
            <span class="x-score-popup-label">${chrome.i18n.getMessage('media')}</span>
            <span class="x-score-popup-value">${mediaType}</span>
          </div>
        </div>
      </div>

      <div class="x-score-popup-footer">
        ${chrome.i18n.getMessage('footer')}
      </div>
    `;

    // Position popup
    document.body.appendChild(popup);

    const rect = badge.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Use absolute positioning so it moves with the page
    popup.style.position = 'absolute';
    popup.style.zIndex = '10000';

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popupHeight = popupRect.height;
    
    // Determine vertical position:
    // Prefer below if there is enough space, or if there is more space below than above.
    if (spaceBelow >= popupHeight || spaceBelow >= spaceAbove) {
      // Show below
      popup.style.top = `${rect.bottom + scrollY + 8}px`;
    } else {
      // Show above
      popup.style.top = `${rect.top + scrollY - popupHeight - 8}px`;
    }

    // Determine horizontal position
    let leftPos = rect.left + scrollX;

    // Adjust position if off-screen (right side)
    if (rect.left + popupRect.width > window.innerWidth) {
      leftPos = (window.innerWidth + scrollX) - popupRect.width - 16;
    }
    popup.style.left = `${leftPos}px`;

    // Close on click outside
    const closePopup = (e) => {
      if (!popup.contains(e.target) && e.target !== badge) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closePopup);
      // Removed scroll listener to prevent menu from closing on scroll
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
    const tweetId = getTweetId(tweetElement);
    const previousId = tweetElement.dataset.xScoreId || '';

    // Handle recycled elements: clear old badge if ID changed or became unknown
    if (previousId && (tweetId === '' || previousId !== tweetId)) {
      const existingBadge = tweetElement.querySelector('.x-score-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      processedTweets.delete(tweetElement);
    }

    if (processedTweets.has(tweetElement)) return;
    processedTweets.add(tweetElement);
    
    // Always update ID to match current element content (including empty id)
    tweetElement.dataset.xScoreId = tweetId;

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