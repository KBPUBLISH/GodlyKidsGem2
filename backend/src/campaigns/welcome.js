const DRIP_EMAILS = {
    day0_welcome: {
        subject: "Welcome to Godly Kids! 🙏",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Welcome to the family, ${firstName}! 🎉</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    I'm Michael, the founder of Godly Kids. Thank you SO much for joining us — it means the world to me!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    I created this app because I believe building faith habits with your kids shouldn't be complicated. Just <strong>5 minutes a day</strong> can plant seeds that last a lifetime.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Here's how to get started:
                </p>
                
                <ol style="color: #333; line-height: 1.8;">
                    <li>Open the app and create a profile for each child</li>
                    <li>Pick a Bible story to start with</li>
                    <li>Make it a daily habit — morning, after school, or bedtime!</li>
                </ol>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.godlykids.com/" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Open Godly Kids
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    Hit reply anytime — I read every email personally.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael Bouchard</strong><br>
                    <span style="color: #666;">Founder, Godly Kids</span>
                </p>
            </div>
        `
    },
    
    day2_tips: {
        subject: "Quick tip: Here's what families love most 💡",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Hey ${firstName}! 👋</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    Hope you've had a chance to explore Godly Kids! I wanted to share what other families tell us they love most:
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>🎧 Audio Stories</strong> — Kids can listen while you cook dinner or drive. No screen required!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>🎮 Bible Games</strong> — Learning scripture through play, not lectures. Kids actually ASK to play these.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>📊 Parent Dashboard</strong> — See what your kids learned without hovering. Perfect for busy parents.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>Pro tip:</strong> Set a specific time each day. Consistency beats perfection. Even 5 minutes builds the habit!
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.godlykids.com/" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Continue Your Journey
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael</strong>
                </p>
            </div>
        `
    },
    
    day4_features: {
        subject: "Have you tried this yet? 🎯",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">${firstName}, quick question...</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    Have your kids tried the <strong>Memory Verse Games</strong> yet?
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Parents tell us their kids end up memorizing Scripture without even realizing they're "learning." The games make it feel like play, not homework.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Try a verse together and talk about what it means to your family.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    That's the goal — faith becoming natural, not forced.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.godlykids.com/" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Try Memory Verse Games
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    How's it going so far? I'd love to hear!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    — Michael
                </p>
            </div>
        `
    },
    
    day6_checkin: {
        subject: "How's it going, ${firstName}? 💬",
        getHtml: (firstName, isTrialUser) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Hey ${firstName}!</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    It's been almost a week since you joined Godly Kids. I wanted to personally check in.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>How's it going?</strong> Are your kids enjoying it? Is there anything confusing or missing?
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    I genuinely want to hear your honest feedback — the good AND the bad. It helps me make this better for families like yours.
                </p>
                
                ${isTrialUser ? `
                <p style="color: #333; line-height: 1.6; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>Quick heads up:</strong> Your trial is ending soon. If Godly Kids has been helpful, I'd love for you to stick around! If not, no pressure — just hit reply and tell me what would make it worth it.
                </p>
                ` : ''}
                
                <p style="color: #333; line-height: 1.6;">
                    Just hit reply — I read every email.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless your family,<br>
                    <strong>Michael</strong>
                </p>
            </div>
        `
    },
    
    day7_final: {
        subject: "One last thing... 🙏",
        getHtml: (firstName, isTrialUser) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">${firstName}, thank you.</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    I just wanted to say thank you for giving Godly Kids a try this week.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Building a faith-filled home isn't easy. The world is loud, life is busy, and sometimes it feels impossible to compete for your kids' attention.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Small, daily faith habits can give your family a meaningful way to connect at home.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    That's why I built this. Not to replace church or family Bible time — but to make it easier for busy parents like you to build those habits, even on the craziest days.
                </p>
                
                ${isTrialUser ? `
                <p style="color: #333; line-height: 1.6;">
                    If you've found value in Godly Kids, I'd be honored to have your family continue with us. 
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.godlykids.com/" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Continue Your Subscription
                    </a>
                </div>
                ` : `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.godlykids.com/" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Open Godly Kids
                    </a>
                </div>
                `}
                
                <p style="color: #333; line-height: 1.6;">
                    Either way, thank you for trusting us with your family. I'm praying for you.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael Bouchard</strong><br>
                    <span style="color: #666;">Founder, Godly Kids</span>
                </p>
            </div>
        `
    }
};


module.exports = DRIP_EMAILS;
