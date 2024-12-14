import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import speech_recognition as sr
import base64
import io
from pydub import AudioSegment

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s: %(message)s',
    handlers=[
        RotatingFileHandler('chatbot.log', maxBytes=50000, backupCount=5),
        logging.StreamHandler()
    ]
)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure Google API
try:
    genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-pro')
    logging.info("Gemini model initialized successfully")
except Exception as e:
    logging.error(f"Failed to initialize Gemini model: {e}")
    model = None

# Chat history to maintain context
chat_history = []

def recognize_speech_from_base64(base64_audio):
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(base64_audio)
        
        # Convert audio to WAV
        audio_segment = AudioSegment.from_file(
            io.BytesIO(audio_bytes), 
            format='webm'
        )
        wav_bytes = audio_segment.export(format='wav').read()
        
        # Use speech recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return text
    except Exception as e:
        logging.error(f"Speech recognition error: {e}")
        return None

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        # Get user message from request
        data = request.json
        
        # Check if audio is provided (base64 encoded)
        base64_audio = data.get('audio')
        user_message = data.get('message', '')

        # If audio is provided, try to convert it to text
        if base64_audio:
            audio_text = recognize_speech_from_base64(base64_audio)
            if audio_text:
                user_message = audio_text
            else:
                return jsonify({'message': 'Could not recognize speech from audio.'}), 400

        # Validate message exists
        if not user_message:
            return jsonify({'message': 'No message or recognizable audio received.'}), 400

        # Validate model is initialized
        if not model:
            return jsonify({'message': 'AI model not initialized.'}), 500

        # Add user message to chat history
        chat_history.append({
            'role': 'user',
            'parts': [user_message]
        })

        try:
            # Create a chat session to maintain context
            chat_session = model.start_chat(history=chat_history)
            response = chat_session.send_message(user_message)

            # Add bot response to chat history
            chat_history.append({
                'role': 'model',
                'parts': [response.text]
            })

            # Limit chat history to prevent excessive memory usage
            if len(chat_history) > 10:
                chat_history.pop(0)

            logging.info(f"Generated response: {response.text}")
            return jsonify({
                'message': response.text,
                'input_method': 'audio' if base64_audio else 'text'
            })

        except Exception as gen_error:
            logging.error(f"Generative AI Error: {gen_error}")
            return jsonify({'message': 'Sorry, I encountered an error generating a response.'}), 500

    except Exception as e:
        logging.error(f"General Error: {e}")
        return jsonify({'message': 'An unexpected error occurred.'}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found', 'message': 'The requested endpoint does not exist.'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error', 'message': 'Something went wrong on our end.'}), 500

if __name__ == '__main__':
    # Ensure API key is set
    if not os.getenv('GOOGLE_API_KEY'):
        logging.error("Google API Key is not set. Please set GOOGLE_API_KEY in .env file.")
        exit(1)

    # Run the Flask app
    app.run(
        host='0.0.0.0',  # Listen on all available interfaces
        port=5000,       # Standard port for development
        debug=True       # Enable debug mode for development
    )