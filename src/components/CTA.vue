<script setup lang="ts">
import { useAuthStore } from '../store/auth.store';
import { Button } from '@/components/ui/button';
</script>

<template>
    <div>
        <Button id="test" raised @click="useAuthStore().login">Try Figma-xr Now</Button>
        <p>or</p>
        <a href="https://www.linkedin.com/in/arthur-mougin/"><Button id="hire" raised>Get in touch</Button></a>
    </div>
</template>

<style scoped>
div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
}

p {
    padding: 1rem;
}
</style>