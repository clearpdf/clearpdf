// Text selection and copy functionality for PDF viewer

module.exports = {
  init: function(textLayerContainer) {
    // Create context menu if it doesn't exist
    let contextMenu = document.getElementById('context-menu');
    if (!contextMenu) {
      contextMenu = document.createElement('div');
      contextMenu.id = 'context-menu';
      contextMenu.className = 'context-menu';
      contextMenu.innerHTML = `
        <ul>
          <li id="copy-text">Copy</li>
        </ul>
      `;
      document.body.appendChild(contextMenu);

      // Add styles for context menu
      const style = document.createElement('style');
      style.textContent = `
        .context-menu {
          position: absolute;
          z-index: 1000;
          background-color: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
          display: none;
        }
        
        .context-menu ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        
        .context-menu li {
          padding: 8px 12px;
          cursor: pointer;
        }
        
        .context-menu li:hover {
          background-color: #f0f0f0;
        }

        /* Add a visual feedback when text is copied */
        .copy-feedback {
          position: fixed;
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          z-index: 2000;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .copy-feedback.show {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);

      // Create copy feedback element
      const copyFeedback = document.createElement('div');
      copyFeedback.className = 'copy-feedback';
      copyFeedback.textContent = 'Text copied!';
      document.body.appendChild(copyFeedback);
    }

    // Function to copy selected text to clipboard
    function copySelectedText() {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText) {
        // Try using the Clipboard API first
        try {
          // Create a fallback method using execCommand
          const fallbackCopy = () => {
            // Create a temporary textarea element
            const textArea = document.createElement('textarea');
            textArea.value = selectedText;
            
            // Make the textarea out of viewport
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            
            // Select and copy the text
            textArea.focus();
            textArea.select();
            
            let success = false;
            try {
              success = document.execCommand('copy');
              if (success) {
                console.log('Text copied to clipboard using execCommand fallback');
                showCopyFeedback();
              } else {
                console.error('execCommand copy failed');
              }
            } catch (e) {
              console.error('execCommand error:', e);
            }
            
            // Clean up
            document.body.removeChild(textArea);
            return success;
          };
          
          // Try modern Clipboard API first
          navigator.clipboard.writeText(selectedText)
            .then(() => {
              console.log('Text copied to clipboard using Clipboard API');
              showCopyFeedback();
            })
            .catch(err => {
              console.error('Clipboard API failed, trying fallback: ', err);
              fallbackCopy();
            });
        } catch (e) {
          console.error('Clipboard operation error:', e);
        }
        return true;
      }
      return false;
    }

    // Function to show copy feedback
    function showCopyFeedback() {
      const copyFeedback = document.querySelector('.copy-feedback');
      if (copyFeedback) {
        copyFeedback.classList.add('show');
        setTimeout(() => {
          copyFeedback.classList.remove('show');
        }, 1500);
      }
    }

    // Add event listeners for context menu
    textLayerContainer.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      // Only show context menu if text is selected
      if (selectedText) {
        // Position the context menu at the mouse position
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'block';
      }
    });

    // Handle copy action from context menu
    document.addEventListener('click', function(e) {
      if (e.target.id === 'copy-text' || e.target.closest('#copy-text')) {
        // Store the current selection before any potential loss of focus
        const storedSelectedText = window.getSelection().toString().trim();
        
        if (storedSelectedText) {
          // Create a temporary textarea element for fallback
          const textArea = document.createElement('textarea');
          textArea.value = storedSelectedText;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          
          // Try using the Clipboard API first
          try {
            navigator.clipboard.writeText(storedSelectedText)
              .then(() => {
                console.log('Text copied to clipboard using Clipboard API');
                showCopyFeedback();
                document.body.removeChild(textArea); // Clean up
              })
              .catch(err => {
                console.error('Clipboard API failed, trying fallback: ', err);
                // Fallback to execCommand
                textArea.focus();
                textArea.select();
                
                try {
                  const success = document.execCommand('copy');
                  if (success) {
                    console.log('Text copied to clipboard using execCommand fallback');
                    showCopyFeedback();
                  } else {
                    console.error('execCommand copy failed');
                  }
                } catch (e) {
                  console.error('execCommand error:', e);
                }
                
                document.body.removeChild(textArea); // Clean up
              });
          } catch (e) {
            console.error('Clipboard operation error:', e);
            // Try fallback immediately if Clipboard API throws
            textArea.focus();
            textArea.select();
            
            try {
              const success = document.execCommand('copy');
              if (success) {
                console.log('Text copied to clipboard using execCommand fallback');
                showCopyFeedback();
              } else {
                console.error('execCommand copy failed');
              }
            } catch (e) {
              console.error('execCommand error:', e);
            }
            
            document.body.removeChild(textArea); // Clean up
          }
        }
        
        // Hide context menu after action
        contextMenu.style.display = 'none';
      }
    });

    // Add keyboard shortcut for copy (Ctrl+C)
    document.addEventListener('keydown', function(e) {
      // Check if Ctrl+C is pressed
      if (e.ctrlKey && e.key === 'c') {
        // Only handle if we're in the PDF viewer area
        if (document.activeElement === document.body || 
            textLayerContainer.contains(document.activeElement) ||
            textLayerContainer.contains(window.getSelection().anchorNode)) {
          if (copySelectedText()) {
            // Prevent default only if we actually copied something
            e.preventDefault();
          }
        }
      }
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', function(e) {
      if (e.target.closest('#context-menu') === null) {
        contextMenu.style.display = 'none';
      }
    });

    // Hide context menu when scrolling
    document.addEventListener('scroll', function() {
      contextMenu.style.display = 'none';
    });
  }
};