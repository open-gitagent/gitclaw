#!/usr/bin/env python3
"""
Simple Flappy Bird Game
Use SPACE or UP arrow to flap
"""

import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 400
SCREEN_HEIGHT = 600
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
SKY_BLUE = (135, 206, 235)
GREEN = (34, 139, 34)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)

# Game variables
GRAVITY = 0.5
FLAP_STRENGTH = -10
PIPE_SPEED = 3
PIPE_GAP = 200
PIPE_FREQUENCY = 90  # frames between pipes

class Bird:
    def __init__(self):
        self.x = 100
        self.y = SCREEN_HEIGHT // 2
        self.velocity = 0
        self.width = 34
        self.height = 24
        
    def flap(self):
        self.velocity = FLAP_STRENGTH
        
    def update(self):
        self.velocity += GRAVITY
        self.y += self.velocity
        
    def draw(self, screen):
        # Draw bird body
        pygame.draw.circle(screen, YELLOW, (int(self.x), int(self.y)), 12)
        # Draw eye
        pygame.draw.circle(screen, BLACK, (int(self.x + 5), int(self.y - 3)), 3)
        # Draw beak
        points = [(self.x + 12, self.y), (self.x + 20, self.y), (self.x + 12, self.y + 5)]
        pygame.draw.polygon(screen, RED, points)
        
    def get_rect(self):
        return pygame.Rect(self.x - 12, self.y - 12, 24, 24)

class Pipe:
    def __init__(self, x):
        self.x = x
        self.width = 60
        self.gap_y = random.randint(150, SCREEN_HEIGHT - 150 - PIPE_GAP)
        self.scored = False
        
    def update(self):
        self.x -= PIPE_SPEED
        
    def draw(self, screen):
        # Top pipe
        pygame.draw.rect(screen, GREEN, (self.x, 0, self.width, self.gap_y))
        pygame.draw.rect(screen, BLACK, (self.x, 0, self.width, self.gap_y), 2)
        # Top pipe cap
        pygame.draw.rect(screen, GREEN, (self.x - 5, self.gap_y - 20, self.width + 10, 20))
        pygame.draw.rect(screen, BLACK, (self.x - 5, self.gap_y - 20, self.width + 10, 20), 2)
        
        # Bottom pipe
        bottom_y = self.gap_y + PIPE_GAP
        pygame.draw.rect(screen, GREEN, (self.x, bottom_y, self.width, SCREEN_HEIGHT - bottom_y))
        pygame.draw.rect(screen, BLACK, (self.x, bottom_y, self.width, SCREEN_HEIGHT - bottom_y), 2)
        # Bottom pipe cap
        pygame.draw.rect(screen, GREEN, (self.x - 5, bottom_y, self.width + 10, 20))
        pygame.draw.rect(screen, BLACK, (self.x - 5, bottom_y, self.width + 10, 20), 2)
        
    def collides(self, bird):
        bird_rect = bird.get_rect()
        top_pipe = pygame.Rect(self.x, 0, self.width, self.gap_y)
        bottom_pipe = pygame.Rect(self.x, self.gap_y + PIPE_GAP, self.width, SCREEN_HEIGHT - self.gap_y - PIPE_GAP)
        return bird_rect.colliderect(top_pipe) or bird_rect.colliderect(bottom_pipe)
    
    def is_off_screen(self):
        return self.x + self.width < 0

class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Flappy Bird")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.large_font = pygame.font.Font(None, 72)
        self.reset()
        
    def reset(self):
        self.bird = Bird()
        self.pipes = []
        self.frame_count = 0
        self.score = 0
        self.game_over = False
        self.started = False
        
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE or event.key == pygame.K_UP:
                    if not self.game_over:
                        self.bird.flap()
                        self.started = True
                    else:
                        self.reset()
                elif event.key == pygame.K_ESCAPE:
                    return False
        return True
        
    def update(self):
        if self.game_over or not self.started:
            return
            
        self.bird.update()
        
        # Check if bird hits ground or ceiling
        if self.bird.y > SCREEN_HEIGHT - 12 or self.bird.y < 12:
            self.game_over = True
            
        # Update pipes
        self.frame_count += 1
        if self.frame_count % PIPE_FREQUENCY == 0:
            self.pipes.append(Pipe(SCREEN_WIDTH))
            
        for pipe in self.pipes[:]:
            pipe.update()
            
            # Check collision
            if pipe.collides(self.bird):
                self.game_over = True
                
            # Update score
            if not pipe.scored and pipe.x + pipe.width < self.bird.x:
                pipe.scored = True
                self.score += 1
                
            # Remove off-screen pipes
            if pipe.is_off_screen():
                self.pipes.remove(pipe)
                
    def draw(self):
        # Draw background
        self.screen.fill(SKY_BLUE)
        
        # Draw ground
        pygame.draw.rect(self.screen, GREEN, (0, SCREEN_HEIGHT - 50, SCREEN_WIDTH, 50))
        pygame.draw.rect(self.screen, BLACK, (0, SCREEN_HEIGHT - 50, SCREEN_WIDTH, 2))
        
        # Draw pipes
        for pipe in self.pipes:
            pipe.draw(self.screen)
            
        # Draw bird
        self.bird.draw(self.screen)
        
        # Draw score
        score_text = self.font.render(f"Score: {self.score}", True, BLACK)
        self.screen.blit(score_text, (10, 10))
        
        # Draw start message
        if not self.started:
            start_text = self.font.render("Press SPACE to Start", True, BLACK)
            text_rect = start_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
            self.screen.blit(start_text, text_rect)
        
        # Draw game over message
        if self.game_over:
            game_over_text = self.large_font.render("GAME OVER", True, RED)
            text_rect = game_over_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 50))
            self.screen.blit(game_over_text, text_rect)
            
            restart_text = self.font.render("Press SPACE to Restart", True, BLACK)
            text_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20))
            self.screen.blit(restart_text, text_rect)
        
        pygame.display.flip()
        
    def run(self):
        running = True
        while running:
            running = self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)
            
        pygame.quit()
        sys.exit()

if __name__ == "__main__":
    game = Game()
    game.run()
