class TrieNode:
    def __init__(self):
        self.children = {}
        self.translation = None
        self.priority = 0  # Priority level: 0=none, 1=Vietphrase, 2=Names

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, phrase_zh, translation_vi, priority):
        """
        Inserts a Chinese phrase and its translation into the Trie.
        Overwrites existing translations if the new translation has higher or equal priority.
        """
        if not phrase_zh:
            return
            
        node = self.root
        for char in phrase_zh:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            
        # Prioritize names (2) over general phrases (1)
        if node.translation is None or priority >= node.priority:
            node.translation = translation_vi
            node.priority = priority

    def search_longest_match(self, text, start_index):
        """
        Finds the longest matching Chinese phrase starting from start_index.
        Returns a tuple of (matched_length, translation, priority).
        If no match is found, returns (0, None, 0).
        """
        node = self.root
        longest_length = 0
        longest_translation = None
        longest_priority = 0
        
        current_index = start_index
        text_length = len(text)
        
        while current_index < text_length:
            char = text[current_index]
            if char in node.children:
                node = node.children[char]
                current_index += 1
                if node.translation is not None:
                    longest_length = current_index - start_index
                    longest_translation = node.translation
                    longest_priority = node.priority
            else:
                break
                
        return longest_length, longest_translation, longest_priority
