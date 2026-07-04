import React from 'react';
import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="App" style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <header style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: 0 }}>Chat Interface</h1>
        </header>
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;