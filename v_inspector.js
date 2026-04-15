/* ============================================
   BLOCKCHAIN INSPECTOR & EXPORT UTILITIES
   Enhanced for modern UI integration
   ============================================ */

// This module provides blockchain inspection and export functionality
// It integrates with the main application's modal system

/**
 * View a specific block from the blockchain chain
 * @param {number} index - The index of the block to view
 */
async function viewBlock(index) {
    try {
        showLoading('Loading block details...');
        
        const res = await fetch(`${API_URL}/chain`);
        if (!res.ok) {
            throw new Error('Failed to fetch chain');
        }
        
        const chain = await res.json();
        const block = chain[index];
        
        if (!block) {
            showToast('Error', 'Block not found', 'error');
            hideLoading();
            return;
        }
        
        // Use the main app's modal system
        const recordModal = document.getElementById('recordModal');
        const recordModalContent = document.getElementById('recordModalContent');
        
        if (!recordModal || !recordModalContent) {
            console.error('Modal elements not found');
            hideLoading();
            return;
        }
        
        // Build detailed block view
        let content = `
            <div class="record-details">
                <div class="detail-section">
                    <h4>Block Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Block Index:</span>
                            <span class="detail-value">#${block.index}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Timestamp:</span>
                            <span class="detail-value">${new Date(block.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Owner:</span>
                            <span class="detail-value">${escapeHtml(block.owner || 'N/A')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Description:</span>
                            <span class="detail-value">${escapeHtml(block.meta?.description || 'N/A')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Blockchain Hashes</h4>
                    <div class="hash-display">
                        <span class="hash-label">Block Hash:</span>
                        <div class="hash-value">${block.hash}</div>
                    </div>
                    <div class="hash-display">
                        <span class="hash-label">Previous Hash:</span>
                        <div class="hash-value">${block.prevHash || 'Genesis Block'}</div>
                    </div>
                    <div class="hash-display">
                        <span class="hash-label">Merkle Root:</span>
                        <div class="hash-value">${block.merkleRoot}</div>
                    </div>
                </div>
        `;
        
        // Add Merkle Tree visualization if available
        if (block.tree && Array.isArray(block.tree) && block.tree.length > 0) {
            content += `
                <div class="detail-section">
                    <h4>Merkle Tree Structure</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                        This tree structure ensures data integrity. Each level represents a hash combination of the level below.
                    </p>
                    <div class="merkle-tree">
            `;
            
            // Reverse tree to show root at top
            const levels = block.tree.slice().reverse();
            
            levels.forEach((level, lvlIdx) => {
                content += '<div class="tree-level">';
                level.forEach((hash, hashIdx) => {
                    const isRoot = lvlIdx === 0;
                    content += `
                        <div class="tree-node ${isRoot ? 'root' : ''}" 
                             title="Level ${levels.length - lvlIdx - 1}, Hash: ${hash}"
                             onclick="copyToClipboard('${hash}')">
                            ${hash.substring(0, 8)}...
                        </div>
                    `;
                });
                content += '</div>';
            });
            
            content += `
                    </div>
                </div>
            `;
        }
        
        // Add full JSON view (collapsible)
        content += `
                <div class="detail-section">
                    <h4>Raw Block Data</h4>
                    <details>
                        <summary style="cursor: pointer; color: var(--primary); margin-bottom: 1rem; font-weight: 500;">
                            View Full JSON
                        </summary>
                        <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-sm); overflow-x: auto; font-size: 0.8rem; color: var(--text-muted);">${JSON.stringify(block, null, 2)}</pre>
                    </details>
                </div>
            </div>
        `;
        
        recordModalContent.innerHTML = content;
        recordModal.classList.remove('hidden');
        recordModal.setAttribute('aria-hidden', 'false');
        
        hideLoading();
        
    } catch (err) {
        console.error('View block error:', err);
        showToast('Error', 'Failed to load block details', 'error');
        hideLoading();
    }
}

/**
 * Export the entire blockchain ledger as JSON
 */
async function exportLedger() {
    try {
        showLoading('Preparing export...');
        
        const res = await fetch(`${API_URL}/chain`);
        if (!res.ok) {
            throw new Error('Failed to fetch chain');
        }
        
        const chain = await res.json();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chain, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `wearable_ledger_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        hideLoading();
        showToast('Export Successful', 'Blockchain ledger downloaded', 'success');
        
    } catch (err) {
        console.error("Export failed", err);
        showToast('Export Failed', 'Unable to export ledger', 'error');
        hideLoading();
    }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied', 'Hash copied to clipboard', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            showToast('Copy Failed', 'Unable to copy to clipboard', 'error');
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('Copied', 'Hash copied to clipboard', 'success');
        } catch (err) {
            console.error('Copy failed:', err);
            showToast('Copy Failed', 'Unable to copy to clipboard', 'error');
        }
        document.body.removeChild(textarea);
    }
}

/**
 * Utility function to escape HTML (if not already defined)
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions to global scope
window.viewBlock = viewBlock;
window.exportLedger = exportLedger;
window.copyToClipboard = copyToClipboard;

// Note: closeRecordModal is already defined in script.js
// This inspector integrates with the main app's modal system
