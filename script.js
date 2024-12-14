document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatMessages = document.getElementById('chatMessages');
    const microphoneIcon = document.createElement('div');

    // Function to add a message to the chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        
        // Auto scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to show typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'bot-message', 'typing-indicator');
        typingDiv.textContent = 'Typing...';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    // Function to remove typing indicator
    function removeTypingIndicator(typingIndicator) {
        if (typingIndicator) {
            chatMessages.removeChild(typingIndicator);
        }
    }

    // Send message function
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, 'user');
        messageInput.value = '';

        // Show typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            // Make API call to backend
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            // Add bot response
            addMessage(data.message, 'bot');
        } catch (error) {
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            // Add error message
            addMessage('Sorry, something went wrong. Please try again.', 'bot');
            console.error('Error:', error);
        }
    }

    // Voice recording functionality
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // Start audio recording
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", processAudioRecording);
            mediaRecorder.start();

            // Add recording message
            addMessage('Recording audio...', 'user');
            isRecording = true;
            microphoneIcon.querySelector('svg').style.fill = 'red';
        } catch (error) {
            console.error('Error accessing microphone:', error);
            addMessage('Could not access microphone. Please check permissions.', 'bot');
        }
    }

    function processAudioRecording() {
        const audioBlob = new Blob(audioChunks, { 
            type: 'audio/webm'  // Explicitly set MIME type
        });
        const reader = new FileReader();
        
        reader.onloadend = function() {
            const base64Audio = reader.result.split(',')[1];
            isRecording = false;
            microphoneIcon.querySelector('svg').style.fill = '';
            sendAudioMessage(base64Audio);
        };
    
        reader.readAsDataURL(audioBlob);
    }

    // Send audio message to backend
    async function sendAudioMessage(base64Audio) {
        // Show typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    audio: base64Audio 
                })
            });

            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            // Add bot response
            addMessage(data.message, 'bot');
        } catch (error) {
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            // Add error message
            addMessage('Sorry, something went wrong with audio processing.', 'bot');
            console.error('Error:', error);
        }
    }

    // Stop audio recording
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Microphone icon for voice recording
    microphoneIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
    `;
    microphoneIcon.style.cursor = 'pointer';
    microphoneIcon.style.margin = '0 10px';

    // Insert voice recording icon 
    sendButton.parentNode.insertBefore(microphoneIcon, sendButton.nextSibling);

    // Voice recording toggle
    microphoneIcon.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });
});