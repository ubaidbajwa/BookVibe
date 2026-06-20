/**
 * main.jsx — Application Entry Point
 *
 * Bootstraps the React tree by mounting it to the `#root` DOM node.
 * The Redux store is provided at the very top level so every component
 * in the tree can access global state (auth, accommodations, booking).
 */

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { store } from './redux/store/store.js'

// ==========================================
// Root Rendering Logic
// ==========================================

const rootElement = document.getElementById('root')

if (rootElement) {
    createRoot(rootElement).render(
        <Provider store={store}>
            <App />
        </Provider>
    )
}
