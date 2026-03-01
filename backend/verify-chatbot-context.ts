import { 
  getRecentNoticesSummary, 
  getUpcomingEventsSummary, 
  getActiveClubsSummary, 
  getRecentLostFoundSummary, 
  getAvailableBooksSummary,
  buildAppContext
} from './src/services/chatbot-context.service.js';

async function verify() {
  console.log('--- Chatbot Context Service Verification ---');
  
  try {
    console.log('\n[Notices]');
    console.log(await getRecentNoticesSummary(3));
    
    console.log('\n[Events]');
    console.log(await getUpcomingEventsSummary(3));
    
    console.log('\n[Clubs]');
    console.log(await getActiveClubsSummary());
    
    console.log('\n[Lost & Found]');
    console.log(await getRecentLostFoundSummary(3));
    
    console.log('\n[Marketplace]');
    console.log(await getAvailableBooksSummary(3));
    
    console.log('\n[Combined Context - Notices & Events]');
    console.log(await buildAppContext(['notices', 'events']));

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    process.exit();
  }
}

verify();
